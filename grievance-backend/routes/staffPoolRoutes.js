import express from "express";
import {
  addStaffToPool,
  getAllStaffPool,
  getStaffPoolByDepartment,
  getStaffPoolByIssueType,
  updateStaffAvailability,
  updateStaffLoad,
  removeStaffFromPool
} from "../controllers/staffPoolController.js";

const router = express.Router();

router.post("/", addStaffToPool);
router.get("/", getAllStaffPool);
router.get("/department/:department", getStaffPoolByDepartment);
router.get("/issue-type/:issueTypeId", getStaffPoolByIssueType);
router.put("/:id/availability", updateStaffAvailability);
router.put("/:id/load", updateStaffLoad);
router.delete("/:id", removeStaffFromPool);

export default router;
