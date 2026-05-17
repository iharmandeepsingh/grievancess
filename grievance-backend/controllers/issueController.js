import IssueType from "../models/IssueType.js";

// Create Issue Type
export const createIssueType = async (req, res) => {
  try {
    const { department, issueName, description } = req.body;

    if (!department || !issueName) {
      return res.status(400).json({ message: "Department and issue name are required" });
    }

    // Check if issue name already exists
    const existingIssue = await IssueType.findOne({ issueName });
    if (existingIssue) {
      return res.status(400).json({ message: "Issue type with this name already exists" });
    }

    const issueType = new IssueType({
      department,
      issueName,
      description: description || ""
    });

    await issueType.save();
    res.status(201).json({ message: "Issue type created successfully", issueType });
  } catch (error) {
    console.error("Error creating issue type:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get All Issue Types
export const getAllIssueTypes = async (req, res) => {
  try {
    const { department } = req.query;
    const filter = department ? { department, isActive: true } : { isActive: true };
    const issueTypes = await IssueType.find(filter).sort({ department: 1, issueName: 1 });
    res.status(200).json(issueTypes);
  } catch (error) {
    console.error("Error fetching issue types:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get Issue Types by Department
export const getIssueTypesByDepartment = async (req, res) => {
  try {
    const { department } = req.params;
    const issueTypes = await IssueType.find({ department, isActive: true }).sort({ issueName: 1 });
    res.status(200).json(issueTypes);
  } catch (error) {
    console.error("Error fetching department issue types:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update Issue Type
export const updateIssueType = async (req, res) => {
  try {
    const { id } = req.params;
    const { description, isActive } = req.body;

    const issueType = await IssueType.findByIdAndUpdate(
      id,
      { description, isActive, updatedAt: Date.now() },
      { new: true }
    );

    if (!issueType) {
      return res.status(404).json({ message: "Issue type not found" });
    }

    res.status(200).json({ message: "Issue type updated successfully", issueType });
  } catch (error) {
    console.error("Error updating issue type:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete Issue Type (Soft delete)
export const deleteIssueType = async (req, res) => {
  try {
    const { id } = req.params;
    const issueType = await IssueType.findByIdAndUpdate(
      id,
      { isActive: false, updatedAt: Date.now() },
      { new: true }
    );

    if (!issueType) {
      return res.status(404).json({ message: "Issue type not found" });
    }

    res.status(200).json({ message: "Issue type deleted successfully" });
  } catch (error) {
    console.error("Error deleting issue type:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export default {
  createIssueType,
  getAllIssueTypes,
  getIssueTypesByDepartment,
  updateIssueType,
  deleteIssueType
};
