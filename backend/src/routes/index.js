import { Router } from "express";
import healthRoutes from "./health.js";
import v1Routes from "./v1/index.js";

const router = Router();

router.use("/health", healthRoutes);
router.use("/v1", v1Routes);

export default router;
