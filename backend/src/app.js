import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "./config.js";
import routes from "./routes/index.js";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin:
      config.corsOrigins.length > 0
        ? config.corsOrigins
        : config.nodeEnv === "development"
          ? true
          : false,
    credentials: true,
  })
);
app.use(morgan(config.nodeEnv === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "2mb" }));
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
