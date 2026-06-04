import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "./config.js";
import routes from "./routes/index.js";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();
const LOCAL_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (config.corsOrigins.length > 0) {
        callback(config.corsOrigins.includes(origin) ? null : new Error("Not allowed by CORS"), config.corsOrigins.includes(origin));
        return;
      }
      // Local development should work even if NODE_ENV was set to production by mistake.
      if (LOCAL_ORIGIN_RE.test(origin)) {
        callback(null, true);
        return;
      }
      callback(config.nodeEnv === "development" ? null : new Error("Not allowed by CORS"), config.nodeEnv === "development");
    },
    credentials: true,
    exposedHeaders: [
      "X-FarmBondhu-AI-Provider",
      "X-FarmBondhu-AI-Model",
      "X-FarmBondhu-AI-Status",
      "X-FarmBondhu-AI-Fallback",
      "X-FarmBondhu-AI-Failed-Models",
    ],
  })
);
app.use(morgan(config.nodeEnv === "production" ? "combined" : "dev"));
/** MediBondhu / vet uploads send files as JSON data URLs — base64 inflates size; keep headroom below typical proxy limits. */
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", routes);

app.get("/", (req, res) => {
  res.json({
    service: "FarmBondhu API",
    docs: "/api/v1",
    health: "/api/health",
  });
});

app.use(notFound);
app.use(errorHandler);

export default app;
