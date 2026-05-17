import RoutingRule from "../models/RoutingRule.js";
import IssueType from "../models/IssueType.js";

// Create Routing Rule
export const createRoutingRule = async (req, res) => {
  try {
    const { issueTypeId, department, assignedStaff, assignmentMode } = req.body;

    if (!issueTypeId || !department || !assignedStaff || !assignmentMode) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Validate issue type exists
    const issueType = await IssueType.findById(issueTypeId);
    if (!issueType) {
      return res.status(404).json({ message: "Issue type not found" });
    }

    // Check if routing rule already exists for this issue type and department
    const existingRule = await RoutingRule.findOne({ issueTypeId, department, isActive: true });
    if (existingRule) {
      return res.status(400).json({ message: "Routing rule already exists for this issue type and department" });
    }

    const routingRule = new RoutingRule({
      issueTypeId,
      department,
      assignedStaff: assignedStaff.map(staff => ({
        staffId: staff.staffId,
        staffName: staff.staffName,
        isAvailable: staff.isAvailable !== undefined ? staff.isAvailable : true,
        roundRobinIndex: 0
      })),
      assignmentMode
    });

    await routingRule.save();
    res.status(201).json({ message: "Routing rule created successfully", routingRule });
  } catch (error) {
    console.error("Error creating routing rule:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get All Routing Rules
export const getAllRoutingRules = async (req, res) => {
  try {
    const { department } = req.query;
    const filter = department ? { department, isActive: true } : { isActive: true };
    const routingRules = await RoutingRule.find(filter)
      .populate('issueTypeId')
      .sort({ department: 1 });
    res.status(200).json(routingRules);
  } catch (error) {
    console.error("Error fetching routing rules:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get Routing Rules by Department
export const getRoutingRulesByDepartment = async (req, res) => {
  try {
    const { department } = req.params;
    const routingRules = await RoutingRule.find({ department, isActive: true })
      .populate('issueTypeId')
      .sort({ 'issueTypeId.issueName': 1 });
    res.status(200).json(routingRules);
  } catch (error) {
    console.error("Error fetching department routing rules:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get Routing Rule by Issue Type
export const getRoutingRuleByIssueType = async (req, res) => {
  try {
    const { issueTypeId } = req.params;
    const routingRule = await RoutingRule.findOne({ issueTypeId, isActive: true })
      .populate('issueTypeId');
    
    if (!routingRule) {
      return res.status(404).json({ message: "No routing rule found for this issue type" });
    }
    
    res.status(200).json(routingRule);
  } catch (error) {
    console.error("Error fetching routing rule:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update Routing Rule
export const updateRoutingRule = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedStaff, assignmentMode, isActive } = req.body;

    const updateData = { updatedAt: Date.now() };
    if (assignedStaff) {
      updateData.assignedStaff = assignedStaff.map(staff => ({
        staffId: staff.staffId,
        staffName: staff.staffName,
        isAvailable: staff.isAvailable !== undefined ? staff.isAvailable : true,
        roundRobinIndex: staff.roundRobinIndex || 0
      }));
    }
    if (assignmentMode) updateData.assignmentMode = assignmentMode;
    if (isActive !== undefined) updateData.isActive = isActive;

    const routingRule = await RoutingRule.findByIdAndUpdate(id, updateData, { new: true });

    if (!routingRule) {
      return res.status(404).json({ message: "Routing rule not found" });
    }

    res.status(200).json({ message: "Routing rule updated successfully", routingRule });
  } catch (error) {
    console.error("Error updating routing rule:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete Routing Rule (Soft delete)
export const deleteRoutingRule = async (req, res) => {
  try {
    const { id } = req.params;
    const routingRule = await RoutingRule.findByIdAndUpdate(
      id,
      { isActive: false, updatedAt: Date.now() },
      { new: true }
    );

    if (!routingRule) {
      return res.status(404).json({ message: "Routing rule not found" });
    }

    res.status(200).json({ message: "Routing rule deleted successfully" });
  } catch (error) {
    console.error("Error deleting routing rule:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Auto-assign grievance based on routing rule
export const autoAssignGrievance = async (issueTypeId, department) => {
  try {
    console.log(`🤖 Auto-assignment requested: issueTypeId=${issueTypeId}, department=${department}`);
    
    const routingRule = await RoutingRule.findOne({ issueTypeId, department, isActive: true });
    
    if (!routingRule) {
      console.log(`❌ No routing rule found for issueTypeId=${issueTypeId}, department=${department}`);
      return null; // No routing rule found, will use manual assignment
    }

    console.log(`✅ Found routing rule: ${routingRule._id}, mode=${routingRule.assignmentMode}`);

    const availableStaff = routingRule.assignedStaff.filter(s => s.isAvailable);
    
    if (availableStaff.length === 0) {
      console.log(`❌ No available staff in routing rule`);
      return null; // No available staff, will use manual assignment
    }

    console.log(`✅ Available staff: ${availableStaff.length}`);

    let assignedStaff;
    const mode = routingRule.assignmentMode;

    if (mode === "single") {
      // Assign to first available staff
      assignedStaff = availableStaff[0];
    } else if (mode === "round_robin") {
      // Find staff with lowest roundRobinIndex
      assignedStaff = availableStaff.reduce((min, staff) => 
        staff.roundRobinIndex < min.roundRobinIndex ? staff : min
      );
      
      // Increment roundRobinIndex for next assignment
      await RoutingRule.updateOne(
        { _id: routingRule._id, "assignedStaff.staffId": assignedStaff.staffId },
        { $inc: { "assignedStaff.$.roundRobinIndex": 1 } }
      );
    } else if (mode === "pool_accept") {
      // Assign to staff with lowest current load (if using StaffPool)
      // For now, use round robin as fallback
      assignedStaff = availableStaff.reduce((min, staff) => 
        staff.roundRobinIndex < min.roundRobinIndex ? staff : min
      );
      
      await RoutingRule.updateOne(
        { _id: routingRule._id, "assignedStaff.staffId": assignedStaff.staffId },
        { $inc: { "assignedStaff.$.roundRobinIndex": 1 } }
      );
    }

    console.log(`✅ Assigned to: ${assignedStaff.staffName} (${assignedStaff.staffId}) in ${mode} mode`);

    return {
      staffId: assignedStaff.staffId,
      staffName: assignedStaff.staffName,
      assignmentMode: mode
    };
  } catch (error) {
    console.error("❌ Error in auto-assignment:", error);
    return null;
  }
};

export default {
  createRoutingRule,
  getAllRoutingRules,
  getRoutingRulesByDepartment,
  getRoutingRuleByIssueType,
  updateRoutingRule,
  deleteRoutingRule,
  autoAssignGrievance
};
