import React, { useState, useEffect } from "react";
import { PlusIcon, TrashIcon, EditIcon, CheckIcon } from "./Icons";

function IssueManagementPanel({ department }) {
  const [issues, setIssues] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingIssue, setEditingIssue] = useState(null);
  const [formData, setFormData] = useState({
    issueName: "",
    description: ""
  });
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  useEffect(() => {
    if (department) {
      fetchIssues();
    }
  }, [department]);

  const fetchIssues = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/issue-types/department/${encodeURIComponent(department)}`);
      if (!res.ok) {
        const errorText = await res.text();
        console.error("Fetch error response:", errorText);
        setMessage(`Failed to load issue types: ${res.status}`);
        setMessageType("error");
        return;
      }
      const data = await res.json();
      console.log("Fetched issues:", data);
      setIssues(data);
    } catch (error) {
      console.error("Error fetching issues:", error);
      setMessage("Failed to load issue types");
      setMessageType("error");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("http://localhost:5000/api/issue-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department,
          issueName: formData.issueName,
          description: formData.description
        })
      });

      if (res.ok) {
        setMessage("Issue type created successfully!");
        setMessageType("success");
        setFormData({ issueName: "", description: "" });
        setShowAddForm(false);
        fetchIssues();
        setTimeout(() => setMessage(""), 3000);
      } else {
        const error = await res.json();
        setMessage(error.message || "Failed to create issue type");
        setMessageType("error");
      }
    } catch (error) {
      console.error("Error creating issue:", error);
      setMessage("Failed to create issue type");
      setMessageType("error");
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingIssue) return;

    try {
      const res = await fetch(`http://localhost:5000/api/issue-types/${editingIssue._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: formData.description,
          isActive: editingIssue.isActive
        })
      });

      if (res.ok) {
        setMessage("Issue type updated successfully!");
        setMessageType("success");
        setEditingIssue(null);
        setFormData({ issueName: "", description: "" });
        fetchIssues();
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage("Failed to update issue type");
        setMessageType("error");
      }
    } catch (error) {
      console.error("Error updating issue:", error);
      setMessage("Failed to update issue type");
      setMessageType("error");
    }
  };

  const handleDelete = async (issueId) => {
    if (!window.confirm("Are you sure you want to delete this issue type?")) return;

    try {
      const res = await fetch(`http://localhost:5000/api/issue-types/${issueId}`, {
        method: "DELETE"
      });

      if (res.ok) {
        setMessage("Issue type deleted successfully!");
        setMessageType("success");
        fetchIssues();
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage("Failed to delete issue type");
        setMessageType("error");
      }
    } catch (error) {
      console.error("Error deleting issue:", error);
      setMessage("Failed to delete issue type");
      setMessageType("error");
    }
  };

  const handleToggleActive = async (issue) => {
    try {
      const res = await fetch(`http://localhost:5000/api/issue-types/${issue._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: issue.description,
          isActive: !issue.isActive
        })
      });

      if (res.ok) {
        fetchIssues();
      }
    } catch (error) {
      console.error("Error toggling issue:", error);
    }
  };

  const startEdit = (issue) => {
    setEditingIssue(issue);
    setFormData({
      issueName: issue.issueName,
      description: issue.description
    });
    setShowAddForm(false);
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
          Issue Types for {department}
        </h2>
        {!showAddForm && !editingIssue && (
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
            <PlusIcon width="16" height="16" /> Add Issue Type
          </button>
        )}
      </div>

      {(showAddForm || editingIssue) && (
        <form
          onSubmit={editingIssue ? handleUpdate : handleSubmit}
          style={{
            background: "#f8fafc",
            padding: "20px",
            borderRadius: "12px",
            marginBottom: "20px",
            border: "1px solid #e2e8f0"
          }}
        >
          <h3 style={{ margin: "0 0 15px 0", color: "#334155" }}>
            {editingIssue ? "Edit Issue Type" : "Create New Issue Type"}
          </h3>
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "600", color: "#475569" }}>
              Issue Name
            </label>
            <input
              type="text"
              value={formData.issueName}
              onChange={(e) => setFormData({ ...formData, issueName: e.target.value })}
              disabled={!!editingIssue}
              placeholder="e.g., Grade Dispute, Fee Issue, Hostel Problem"
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontSize: "1rem"
              }}
              required
            />
          </div>
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "600", color: "#475569" }}>
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe this issue type..."
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontSize: "1rem",
                minHeight: "80px",
                resize: "vertical"
              }}
            />
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
              {editingIssue ? "Update" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setEditingIssue(null);
                setFormData({ issueName: "", description: "" });
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

      {issues.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "40px",
          background: "white",
          borderRadius: "12px",
          border: "1px dashed #cbd5e1"
        }}>
          <p style={{ color: "#64748b", margin: 0 }}>No issue types defined yet</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "15px" }}>
          {issues.map((issue) => (
            <div
              key={issue._id}
              style={{
                background: "white",
                padding: "20px",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                opacity: issue.isActive ? 1 : 0.6
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "10px" }}>
                <h3 style={{ margin: 0, color: "#1e293b", fontSize: "1.1rem" }}>
                  {issue.issueName}
                </h3>
                <span
                  style={{
                    padding: "4px 8px",
                    borderRadius: "12px",
                    fontSize: "0.75rem",
                    fontWeight: "600",
                    background: issue.isActive ? "#f0fdf4" : "#f1f5f9",
                    color: issue.isActive ? "#16a34a" : "#64748b"
                  }}
                >
                  {issue.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <p style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: "15px", minHeight: "40px" }}>
                {issue.description || "No description"}
              </p>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => handleToggleActive(issue)}
                  style={{
                    flex: 1,
                    padding: "8px",
                    background: issue.isActive ? "#f0fdf4" : "#f8fafc",
                    color: issue.isActive ? "#16a34a" : "#64748b",
                    border: `1px solid ${issue.isActive ? "#16a34a" : "#cbd5e1"}`,
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    fontWeight: "600"
                  }}
                >
                  {issue.isActive ? "Deactivate" : "Activate"}
                </button>
                <button
                  onClick={() => startEdit(issue)}
                  style={{
                    padding: "8px",
                    background: "#eff6ff",
                    color: "#2563eb",
                    border: "1px solid #2563eb",
                    borderRadius: "6px",
                    cursor: "pointer"
                  }}
                  title="Edit"
                >
                  <EditIcon width="14" height="14" />
                </button>
                <button
                  onClick={() => handleDelete(issue._id)}
                  style={{
                    padding: "8px",
                    background: "#fef2f2",
                    color: "#dc2626",
                    border: "1px solid #dc2626",
                    borderRadius: "6px",
                    cursor: "pointer"
                  }}
                  title="Delete"
                >
                  <TrashIcon width="14" height="14" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default IssueManagementPanel;
