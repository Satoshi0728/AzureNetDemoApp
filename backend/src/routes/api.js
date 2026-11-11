import { Router } from "express";
import v1Router from "./v1/index.js";

const router = Router();

router.get("/healthz", (req, res) => {
  res.json({
    ok: true,
    service: "kof-backend",
    timestamp: new Date().toISOString(),
    version: "1.5.1",
  });
});

router.use("/v1", v1Router);

export default router;
