import StaffPool from "../models/StaffPool.js";
import IssueType from "../models/IssueType.js";

// Add Staff to Pool
export const addStaffToPool = async (req, res) => {
  try {
    const { staffId, staffName, department, issueTypeIds, maxLoad } = req.body;

    if (!staffId || !staffName || !department || !issueTypeIds) {
      return res.status(400).json({ message: "Staff ID, name, department, and issue types are required" });
    }

    // Validate issue types exist
    const validIssueTypes = await IssueType.find({ _id: { $in: issueTypeIds } });
    if (validIssueTypes.length !== issueTypeIds.length) {
      return res.status(400).json({ message: "Some issue types are invalid" });
    }

    // Check if staff already in pool
    const existingPool = await StaffPool.findOne({ staffId });
    if (existingPool) {
      // Add new issue types to existing pool
      const newIssueTypes = issueTypeIds.filter(id => !existingPool.issueTypeIds.includes(id));
      if (newIssueTypes.length === 0) {
        return res.status(400).json({ message: "Staff already in pool with all specified issue types" });
      }
      existingPool.issueTypeIds.push(...newIssueTypes);
      if (maxLoad) existingPool.maxLoad = maxLoad;
      await existingPool.save();
      return res.status(200).json({ message: "Staff pool updated successfully", staffPool: existingPool });
    }

    const staffPool = new StaffPool({
      staffId,
      staffName,
      department,
      issueTypeIds,
      maxLoad: maxLoad || 10,
      isAvailable: true,
      currentLoad: 0
    });

    await staffPool.save();
    res.status(201).json({ message: "Staff added to pool successfully", staffPool });
  } catch (error) {
    console.error("Error adding staff to pool:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get All Staff Pool
export const getAllStaffPool = async (req, res) => {
  try {
    const { department, issueTypeId } = req.query;
    const filter = { isAvailable: true };
    
    if (department) filter.department = department;
    if (issueTypeId) filter.issueTypeIds = issueTypeId;

    const staffPool = await StaffPool.find(filter)
      .populate('issueTypeIds')
      .populate('assignedGrievanceIds')
      .sort({ department: 1, staffName: 1 });
    
    res.status(200).json(staffPool);
  } catch (error) {
    console.error("Error fetching staff pool:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get Staff Pool by Department
export const getStaffPoolByDepartment = async (req, res) => {
  try {
    const { department } = req.params;
    const staffPool = await StaffPool.find({ department, isAvailable: true })
      .populate('issueTypeIds')
      .sort({ staffName: 1 });
    
    res.status(200).json(staffPool);
  } catch (error) {
    console.error("Error fetching department staff pool:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get Staff Pool by Issue Type
export const getStaffPoolByIssueType = async (req, res) => {
  try {
    const { issueTypeId } = req.params;
    const staffPool = await StaffPool.find({ issueTypeIds: issueTypeId, isAvailable: true })
      .populate('issueTypeIds')
      .sort({ currentLoad: 1, staffName: 1 });
    
    res.status(200).json(staffPool);
  } catch (error) {
    console.error("Error fetching staff pool by issue type:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update Staff Availability
export const updateStaffAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { isAvailable } = req.body;

    const staffPool = await StaffPool.findByIdAndUpdate(
      id,
      { isAvailable, updatedAt: Date.now() },
      { new: true }
    );

    if (!staffPool) {
      return res.status(404).json({ message: "Staff pool entry not found" });
    }

    res.status(200).json({ message: "Staff availability updated successfully", staffPool });
  } catch (error) {
    console.error("Error updating staff availability:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update Staff Load
export const updateStaffLoad = async (req, res) => {
  try {
    const { id } = req.params;
    const { increment } = req.body; // true to increment, false to decrement

    const staffPool = await StaffPool.findById(id);
    if (!staffPool) {
      return res.status(404).json({ message: "Staff pool entry not found" });
    }

    if (increment) {
      if (staffPool.currentLoad >= staffPool.maxLoad) {
        return res.status(400).json({ message: "Staff has reached maximum load" });
      }
      staffPool.currentLoad += 1;
    } else {
      staffPool.currentLoad = Math.max(0, staffPool.currentLoad - 1);
    }

    staffPool.updatedAt = Date.now();
    await staffPool.save();

    res.status(200).json({ message: "Staff load updated successfully", staffPool });
  } catch (error) {
    console.error("Error updating staff load:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Add Grievance to Staff Assignment
export const addGrievanceToStaff = async (staffId, grievanceId) => {
  try {
    const staffPool = await StaffPool.findOne({ staffId, isAvailable: true });
    if (!staffPool) {
      return false;
    }

    if (staffPool.currentLoad >= staffPool.maxLoad) {
      return false;
    }

    staffPool.assignedGrievanceIds.push(grievanceId);
    staffPool.currentLoad += 1;
    staffPool.updatedAt = Date.now();
    await staffPool.save();

    return true;
  } catch (error) {
    console.error("Error adding grievance to staff:", error);
    return false;
  }
};

// Remove Grievance from Staff Assignment
export const removeGrievanceFromStaff = async (staffId, grievanceId) => {
  try {
    const staffPool = await StaffPool.findOne({ staffId });
    if (!staffPool) {
      return false;
    }

    staffPool.assignedGrievanceIds = staffPool.assignedGrievanceIds.filter(
      id => id.toString() !== grievanceId.toString()
    );
    staffPool.currentLoad = Math.max(0, staffPool.currentLoad - 1);
    staffPool.updatedAt = Date.now();
    await staffPool.save();

    return true;
  } catch (error) {
    console.error("Error removing grievance from staff:", error);
    return false;
  }
};

// Remove Staff from Pool
export const removeStaffFromPool = async (req, res) => {
  try {
    const { id } = req.params;
    const staffPool = await StaffPool.findByIdAndDelete(id);

    if (!staffPool) {
      return res.status(404).json({ message: "Staff pool entry not found" });
    }

    res.status(200).json({ message: "Staff removed from pool successfully" });
  } catch (error) {
    console.error("Error removing staff from pool:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export default {
  addStaffToPool,
  getAllStaffPool,
  getStaffPoolByDepartment,
  getStaffPoolByIssueType,
  updateStaffAvailability,
  updateStaffLoad,
  addGrievanceToStaff,
  removeGrievanceFromStaff,
  removeStaffFromPool
};
