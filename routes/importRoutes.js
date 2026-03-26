import express from "express";
import { protect, authorize } from "../middleware/authMiddleware.js";
import {
  uploadLeads,
  getImportBatches,
  getImportBatch,
  getImportBatchFailures,
} from "../controllers/importController.js";

const router = express.Router();

router.use(protect);
router.use(authorize("admin", "manager"));
router.post("/upload", uploadLeads);
router.get("/batches", getImportBatches);
router.get("/batches/:id", getImportBatch);
router.get("/batches/:id/failures", getImportBatchFailures);

export default router;
