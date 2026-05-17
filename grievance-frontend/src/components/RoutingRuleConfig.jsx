import React, { useState, useEffect } from "react";
import { PlusIcon, TrashIcon, SaveIcon } from "./Icons";

function RoutingRuleConfig({ department }) {
  const [routingRules, setRoutingRules] = useState([]);
  const [issues, setIssues] = useState([]);
  const [departmentStaff, setDepartmentStaff] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    issueTypeId: "",
    assignedStaff: [],
    assignmentMode: "single"
  });
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  useEffect(() => {
    if (department) {
      fetchRoutingRules();
      fetchIssues();
      fetchDepartmentStaff();
    }
  }, [department]);

  const fetchRoutingRules = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/routing-rules/department/${encodeURIComponent(department)}`);
      if (!res.ok) {
        const errorText = await res.text();
        console.error("Fetch routing rules error:", errorText);
        return;
      }
      const data = await res.json();
      console.log("Fetched routing rules:", data);
      setRoutingRules(data);
    } catch (error) {
      console.error("Error fetching routing rules:", error);
    }
  };

  const fetchIssues = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/issue-types/department/${encodeURIComponent(department)}`);
      if (!res.ok) {
        const errorText = await res.text();
        console.error("Fetch issues error:", errorText);
        return;
      }
      const data = await res.json();
      console.log("Fetched issues:", data);
      setIssues(data);
    } catch (error) {
      console.error("Error fetching issues:", error);
    }
  };

  const fetchDepartmentStaff = async () => {
    try {
      const token = localStorage.getItem("grievance_token");
      if (!token) {
        console.error("No token found");
        return;
      }
      const res = await fetch(`http://localhost:5000/api/admin/staff/${encodeURIComponent(department)}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error("Fetch department staff error:", errorText);
        return;
      }
      const data = await res.json();
      console.log("Fetched department staff:", data);
      setDepartmentStaff(data);
    } catch (error) {
      console.error("Error fetching department staff:", error);
    }
  };

  const handleStaffToggle = (staffId, staffName) => {
    const currentStaff = formData.assignedStaff.find(s => s.staffId === staffId);
    if (currentStaff) {
      setFormData({
        ...formData,
        assignedStaff: formData.assignedStaff.filter(s => s.staffId !== staffId)
      });
    } else {
      setFormData({
        ...formData,
        assignedStaff: [...formData.assignedStaff, { staffId, staffName, isAvailable: true }]
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.assignedStaff.length === 0) {
      setMessage("Please select at least one staff member");
      setMessageType("error");
      return;
    }

    try {
      const res = await fetch("http://localhost:5000/api/routing-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueTypeId: formData.issueTypeId,
          department,
          assignedStaff: formData.assignedStaff,
          assignmentMode: formData.assignmentMode
        })
      });

      if (res.ok) {
        setMessage("Routing rule created successfully!");
        setMessageType("success");
        setFormData({
          issueTypeId: "",
          assignedStaff: [],
          assignmentMode: "single"
        });
        setShowAddForm(false);
        fetchRoutingRules();
        setTimeout(() => setMessage(""), 3000);
      } else {
        const error = await res.json();
        setMessage(error.message || "Failed to create routing rule");
        setMessageType("error");
      }
    } catch (error) {
      console.error("Error creating routing rule:", error);
      setMessage("Failed to create routing rule");
      setMessageType("error");
    }
  };

  const handleDelete = async (ruleId) => {
    if (!window.confirm("Are you sure you want to delete this routing rule?")) return;

    try {
      const res = await fetch(`http://localhost:5000/api/routing-rules/${ruleId}`, {
        method: "DELETE"
      });

      if (res.ok) {
        setMessage("Routing rule deleted successfully!");
        setMessageType("success");
        fetchRoutingRules();
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage("Failed to delete routing rule");
        setMessageType("error");
      }
    } catch (error) {
      console.error("Error deleting routing rule:", error);
      setMessage("Failed to delete routing rule");
      setMessageType("error");
    }
  };

  const getAssignmentModeLabel = (mode) => {
    switch (mode) {
      case "single": return "Single Assign (First Available)";
      case "round_robin": return "Round Robin (Load Balance)";
      case "pool_accept": return "Pool Accept (First to Accept)";
      default: return mode;
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      {message && (
        <div className={`alert-box ${messageType}`} style={{ marginBottom: "20px" }}>
          {message}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 style={{ margin: 0, color: "#1e293b" }}>
          Routing Rules for {department}
        </h2>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            style={{
              padding: "10px 20px",
              background: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <PlusIcon width="16" height="16" /> Create Routing Rule
          </button>
        )}
      </div>

      {showAddForm && (
        <form
          onSubmit={handleSubmit}
          style={{
            background: "#f8fafc",
            padding: "20px",
            borderRadius: "12px",
            marginBottom: "20px",
            border: "1px solid #e2e8f0"
          }}
        >
          <h3 style={{ margin: "0 0 15px 0", color: "#334155" }}>
            Create New Routing Rule
          </h3>
          
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "600", color: "#475569" }}>
              Issue Type
            </label>
            <select
              value={formData.issueTypeId}
              onChange={(e) => setFormData({ ...formData, issueTypeId: e.target.value })}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontSize: "1rem",
                zIndex: 1000,
                position: "relative"
              }}
              required
            >
              <option value="">Select an issue type...</option>
              {issues.map((issue) => (
                <option key={issue._id} value={issue._id}>
                  {issue.issueName}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "600", color: "#475569" }}>
              Assignment Mode
            </label>
            <select
              value={formData.assignmentMode}
              onChange={(e) => setFormData({ ...formData, assignmentMode: e.target.value })}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontSize: "1rem",
                zIndex: 1000,
                position: "relative"
              }}
            >
              <option value="single">Single Assign (First Available)</option>
              <option value="round_robin">Round Robin (Load Balance)</option>
              <option value="pool_accept">Pool Accept (First to Accept)</option>
            </select>
            <p style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "5px" }}>
              {formData.assignmentMode === "single" && "Grievances will always be assigned to the first available staff in the list."}
              {formData.assignmentMode === "round_robin" && "Grievances will be distributed evenly among all selected staff."}
              {formData.assignmentMode === "pool_accept" && "All selected staff will see the grievance, and the first to accept gets assigned."}
            </p>
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "10px", fontWeight: "600", color: "#475569" }}>
              Assign Staff ({formData.assignedStaff.length} selected)
            </label>
            {departmentStaff.length === 0 ? (
              <p style={{ color: "#64748b" }}>No staff available in this department</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px" }}>
                {departmentStaff.map((staff) => (
                  <div
                    key={staff.id}
                    onClick={() => handleStaffToggle(staff.id, staff.fullName)}
                    style={{
                      padding: "10px",
                      borderRadius: "8px",
                      border: formData.assignedStaff.find(s => s.staffId === staff.id)
                        ? "2px solid #2563eb"
                        : "1px solid #cbd5e1",
                      background: formData.assignedStaff.find(s => s.staffId === staff.id)
                        ? "#eff6ff"
                        : "white",
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                  >
                    <div style={{ fontWeight: "600", color: "#1e293b", fontSize: "0.9rem" }}>
                      {staff.fullName}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                      {staff.id}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="submit"
              style={{
                padding: "10px 20px",
                background: "#2563eb",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "600"
              }}
            >
              <SaveIcon width="16" height="16" style={{ marginRight: "5px" }} />
              Save Routing Rule
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setFormData({
                  issueTypeId: "",
                  assignedStaff: [],
                  assignmentMode: "single"
                });
              }}
              style={{
                padding: "10px 20px",
                background: "#64748b",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "600"
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {routingRules.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "40px",
          background: "white",
          borderRadius: "12px",
          border: "1px dashed #cbd5e1"
        }}>
          <p style={{ color: "#64748b", margin: 0 }}>No routing rules configured yet</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "15px" }}>
          {routingRules.map((rule) => (
            <div
              key={rule._id}
              style={{
                background: "white",
                padding: "20px",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
              }}
            >
              <div style={{ marginBottom: "15px" }}>
                <span style={{
                  padding: "4px 8px",
                  borderRadius: "12px",
                  fontSize: "0.75rem",
                  fontWeight: "600",
                  background: "#dbeafe",
                  color: "#1e40af"
                }}>
                  {getAssignmentModeLabel(rule.assignmentMode)}
                </span>
              </div>
              
              <h3 style={{ margin: "0 0 5px 0", color: "#1e293b", fontSize: "1.1rem" }}>
                {rule.issueTypeId?.issueName || "Unknown Issue"}
              </h3>
              <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "15px" }}>
                {rule.issueTypeId?.description || "No description"}
              </p>

              <div style={{ marginBottom: "15px" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "#475569", marginBottom: "8px" }}>
                  Assigned Staff ({rule.assignedStaff.length}):
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                  {rule.assignedStaff.map((staff, idx) => (
                    <span
                      key={idx}
                      style={{
                        padding: "4px 8px",
                        background: "#f1f5f9",
                        borderRadius: "6px",
                        fontSize: "0.8rem",
                        color: "#334155"
                      }}
                    >
                      {staff.staffName}
                    </span>
                  ))}
                </div>
              </div>

              <button
                onClick={() => handleDelete(rule._id)}
                style={{
                  width: "100%",
                  padding: "8px",
                  background: "#fef2f2",
                  color: "#dc2626",
                  border: "1px solid #dc2626",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "0.85rem"
                }}
              >
                <TrashIcon width="12" height="12" style={{ marginRight: "5px" }} />
                Delete Rule
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default RoutingRuleConfig;
