import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";
import { pipeline } from "stream/promises";
import { createReadStream, createWriteStream } from "fs";

const execAsync = promisify(exec);

const BACKUP_DIR = process.env.BACKUP_DIR || "/tmp/dopik-backups";
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || "7", 10);

export type BackupStatus = {
  lastBackupAt: string | null;
  lastBackupFile: string | null;
  lastStatus: "success" | "failed" | "never";
  lastError: string | null;
  destination: string;
};

// In-memory status (resets on server restart, sufficient for this use case)
let backupStatus: BackupStatus = {
  lastBackupAt: null,
  lastBackupFile: null,
  lastStatus: "never",
  lastError: null,
  destination: process.env.BACKUP_DESTINATION || "local",
};

export function getBackupStatus(): BackupStatus {
  return { ...backupStatus };
}

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function timestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
}

async function dumpDatabase(outputPath: string): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");

  const sqlPath = outputPath.replace(".gz", "");
  await execAsync(`pg_dump "${databaseUrl}" -f "${sqlPath}" --no-owner --no-privileges`);

  // Gzip the dump
  await pipeline(
    createReadStream(sqlPath),
    zlib.createGzip(),
    createWriteStream(outputPath),
  );
  fs.unlinkSync(sqlPath);
}

async function uploadToGoogleDrive(filePath: string): Promise<void> {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not set");

  const { google } = await import("googleapis");
  const credentials = JSON.parse(serviceAccountJson);

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });

  const drive = google.drive({ version: "v3", auth });

  // Find or create DopikBackups folder
  const folderRes = await drive.files.list({
    q: "name='DopikBackups' and mimeType='application/vnd.google-apps.folder' and trashed=false",
    fields: "files(id,name)",
  });

  let folderId: string;
  if (folderRes.data.files && folderRes.data.files.length > 0) {
    folderId = folderRes.data.files[0].id!;
  } else {
    const created = await drive.files.create({
      requestBody: { name: "DopikBackups", mimeType: "application/vnd.google-apps.folder" },
      fields: "id",
    });
    folderId = created.data.id!;
  }

  await drive.files.create({
    requestBody: { name: path.basename(filePath), parents: [folderId] },
    media: { mimeType: "application/gzip", body: createReadStream(filePath) },
    fields: "id",
  });
}

async function uploadToOneDrive(filePath: string): Promise<void> {
  const clientId = process.env.ONEDRIVE_CLIENT_ID;
  const clientSecret = process.env.ONEDRIVE_CLIENT_SECRET;
  const tenantId = process.env.ONEDRIVE_TENANT_ID;
  if (!clientId || !clientSecret || !tenantId) {
    throw new Error("OneDrive credentials not set (ONEDRIVE_CLIENT_ID, ONEDRIVE_CLIENT_SECRET, ONEDRIVE_TENANT_ID)");
  }

  // Get access token via client credentials
  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    }
  );
  const tokenData = await tokenRes.json() as any;
  if (!tokenData.access_token) throw new Error("Failed to get OneDrive token: " + JSON.stringify(tokenData));

  const token = tokenData.access_token;
  const fileName = path.basename(filePath);
  const fileContent = fs.readFileSync(filePath);

  // Create folder if needed, then upload
  const uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/DopikBackups/${fileName}:/content`;
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/gzip",
    },
    body: fileContent,
  });
  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`OneDrive upload failed: ${err}`);
  }
}

async function pruneOldBackups(): Promise<void> {
  if (!fs.existsSync(BACKUP_DIR)) return;
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith("backup_") && f.endsWith(".sql.gz"))
    .map(f => ({ name: f, time: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
    .sort((a, b) => b.time - a.time);

  // Keep only last RETENTION_DAYS backups
  for (const file of files.slice(RETENTION_DAYS)) {
    fs.unlinkSync(path.join(BACKUP_DIR, file.name));
  }
}

export async function runBackup(): Promise<{ success: boolean; file?: string; error?: string }> {
  try {
    ensureBackupDir();
    const ts = timestamp();
    const fileName = `backup_${ts}.sql.gz`;
    const filePath = path.join(BACKUP_DIR, fileName);

    await dumpDatabase(filePath);

    const destination = process.env.BACKUP_DESTINATION || "local";
    if (destination === "googledrive") {
      await uploadToGoogleDrive(filePath);
    } else if (destination === "onedrive") {
      await uploadToOneDrive(filePath);
    }
    // "local" — just keep the file locally

    await pruneOldBackups();

    backupStatus = {
      lastBackupAt: new Date().toISOString(),
      lastBackupFile: fileName,
      lastStatus: "success",
      lastError: null,
      destination,
    };

    return { success: true, file: fileName };
  } catch (err: any) {
    backupStatus = {
      ...backupStatus,
      lastBackupAt: new Date().toISOString(),
      lastStatus: "failed",
      lastError: err.message,
    };
    return { success: false, error: err.message };
  }
}
