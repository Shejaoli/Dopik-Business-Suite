import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import { PgSessionStore } from "./lib/session-store";
import router from "./routes";
import { logger } from "./lib/logger";
import cron from "node-cron";
import { runBackup } from "./lib/pg-backup";

const app: Express = express();

// Trust the reverse proxy (Replit, Nginx, etc.) so req.secure is correct on HTTPS deployments
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  store: new PgSessionStore(),
  secret: process.env.SESSION_SECRET || "dopik-secret-2026",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
}));

app.use("/api", router);

// Scheduled backup cron job
const cronSchedule = process.env.BACKUP_CRON_SCHEDULE || "0 2 * * *";
cron.schedule(cronSchedule, async () => {
  logger.info("Running scheduled database backup...");
  const result = await runBackup();
  if (result.success) {
    logger.info({ file: result.file }, "Scheduled backup completed");
  } else {
    logger.error({ error: result.error }, "Scheduled backup failed");
  }
});

export default app;
