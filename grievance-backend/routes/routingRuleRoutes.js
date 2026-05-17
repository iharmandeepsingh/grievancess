import express from "express";
import {
  createRoutingRule,
  getAllRoutingRules,
  getRoutingRulesByDepartment,
  getRoutingRuleByIssueType,
  updateRoutingRule,
  deleteRoutingRule
} from "../controllers/routingRuleController.js";

const router = express.Router();

router.post("/", createRoutingRule);
router.get("/", getAllRoutingRules);
router.get("/department/:department", getRoutingRulesByDepartment);
router.get("/issue-type/:issueTypeId", getRoutingRuleByIssueType);
router.put("/:id", updateRoutingRule);
router.delete("/:id", deleteRoutingRule);

export default router;
