import { Store } from "express-session";
import { pool } from "@workspace/db";

export class PgSessionStore extends Store {
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    super();
    // Prune expired sessions every 15 minutes
    this.cleanupInterval = setInterval(() => {
      pool.query("DELETE FROM session WHERE expire < NOW()").catch(() => {});
    }, 15 * 60 * 1000);
    this.cleanupInterval.unref();
  }

  get(sid: string, cb: (err: any, session?: any) => void): void {
    pool
      .query("SELECT sess FROM session WHERE sid = $1 AND expire > NOW()", [sid])
      .then((result) => {
        if (result.rows.length === 0) return cb(null, null);
        cb(null, result.rows[0].sess);
      })
      .catch(cb);
  }

  set(sid: string, session: any, cb?: (err?: any) => void): void {
    const expire = session.cookie?.expires
      ? new Date(session.cookie.expires)
      : new Date(Date.now() + (session.cookie?.maxAge ?? 7 * 24 * 60 * 60 * 1000));

    pool
      .query(
        `INSERT INTO session (sid, sess, expire)
         VALUES ($1, $2, $3)
         ON CONFLICT (sid) DO UPDATE SET sess = $2, expire = $3`,
        [sid, JSON.stringify(session), expire]
      )
      .then(() => cb?.())
      .catch((err) => cb?.(err));
  }

  destroy(sid: string, cb?: (err?: any) => void): void {
    pool
      .query("DELETE FROM session WHERE sid = $1", [sid])
      .then(() => cb?.())
      .catch((err) => cb?.(err));
  }

  touch(sid: string, session: any, cb?: (err?: any) => void): void {
    const expire = session.cookie?.expires
      ? new Date(session.cookie.expires)
      : new Date(Date.now() + (session.cookie?.maxAge ?? 7 * 24 * 60 * 60 * 1000));

    pool
      .query("UPDATE session SET expire = $2 WHERE sid = $1", [sid, expire])
      .then(() => cb?.())
      .catch((err) => cb?.(err));
  }
}
