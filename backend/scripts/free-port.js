/**
 * Clears BACKEND_PORT (default 3001) before `npm run dev` (predev) in development.
 * Uses kill-port (netstat/TaskKill on Windows, lsof on Unix).
 * Skips in production so deploy hosts are not affected.
 */
import "dotenv/config";
import killPort from "kill-port";

if (process.env.NODE_ENV === "production") {
  process.exit(0);
}

const port = Number(process.env.BACKEND_PORT) || 3001;

killPort(port)
  .then(() => {
    console.log(`[farmbondhu-api] Port ${port} cleared (or was already free).`);
  })
  .catch((err) => {
    const msg = String(err?.message || err);
    if (/no process|not found|Nothing listening/i.test(msg)) {
      console.log(`[farmbondhu-api] Port ${port} was already free.`);
      return;
    }
    console.warn(`[farmbondhu-api] free-port:`, msg);
  });
