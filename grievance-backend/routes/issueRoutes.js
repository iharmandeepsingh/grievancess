import express from "express";
import {
  createIssueType,
  getAllIssueTypes,
  getIssueTypesByDepartment,
  updateIssueType,
  deleteIssueType
} from "../controllers/issueController.js";

const router = express.Router();

router.post("/", createIssueType);
router.get("/", getAllIssueTypes);
router.get("/department/:department", getIssueTypesByDepartment);
router.put("/:id", updateIssueType);
router.delete("/:id", deleteIssueType);

export default router;
