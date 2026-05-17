import mongoose from "mongoose";
import connectDB from "../config/db.js";
import RoutingRule from "../models/RoutingRule.js";
import IssueType from "../models/IssueType.js";
import Grievance from "../models/GrievanceModel.js";

async function checkRoutingRules() {
  try {
    await connectDB();
    console.log("✅ Connected to database\n");

    console.log("📋 ISSUE TYPES:");
    const issueTypes = await IssueType.find({});
    console.log(`Total issue types: ${issueTypes.length}`);
    issueTypes.forEach(issue => {
      console.log(`  - ${issue.issueName} (ID: ${issue._id}, Department: ${issue.department}, Active: ${issue.isActive})`);
    });

    console.log("\n📋 ROUTING RULES:");
    const routingRules = await RoutingRule.find({}).populate('issueTypeId');
    console.log(`Total routing rules: ${routingRules.length}`);
    routingRules.forEach(rule => {
      console.log(`  - Issue: ${rule.issueTypeId?.issueName || 'N/A'} (ID: ${rule.issueTypeId?._id})`);
      console.log(`    Department: ${rule.department}`);
      console.log(`    Assignment Mode: ${rule.assignmentMode}`);
      console.log(`    Active: ${rule.isActive}`);
      console.log(`    Staff: ${rule.assignedStaff.length} staff assigned`);
      rule.assignedStaff.forEach(staff => {
        console.log(`      - ${staff.staffName} (${staff.staffId}) - Available: ${staff.isAvailable}`);
      });
    });

    console.log("\n📋 RECENT GRIEVANCES:");
    const recentGrievances = await Grievance.find({}).sort({ createdAt: -1 }).limit(5);
    console.log(`Total recent grievances: ${recentGrievances.length}`);
    recentGrievances.forEach(g => {
      console.log(`  - Grievance ID: ${g._id}`);
      console.log(`    Category: ${g.category}`);
      console.log(`    Issue Type ID: ${g.issueTypeId || 'N/A'}`);
      console.log(`    Assigned To: ${g.assignedTo || 'N/A'}`);
      console.log(`    Assignment Mode: ${g.assignmentMode || 'N/A'}`);
      console.log(`    Status: ${g.status}`);
      console.log(`    Created At: ${g.createdAt}`);
    });

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

checkRoutingRules();
