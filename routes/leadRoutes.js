import express from "express";
import { protect, authorize } from "../middleware/authMiddleware.js";
import {
  getLeads,
  getLead,
  createLead,
  updateLead,
  deleteLead,
  assignLead,
  logInteraction,
  getLeadTimeline,
  getLeadStats,
  getLeadActivity,
} from "../controllers/leadController.js";

const router = express.Router();

router.use(protect);
router.get("/get-activity", getLeadActivity);
router.get("/stats", getLeadStats);
router.route("/").get(getLeads).post(authorize("admin", "manager"), createLead);
router
  .route("/:id")
  .get(getLead)
  .put(updateLead)
  .delete(authorize("admin", "manager"), deleteLead);

router.post("/:id/assign", authorize("admin", "manager"), assignLead);
router.post("/:id/interactions", logInteraction);
router.get("/:id/timeline", getLeadTimeline);

export default router;
