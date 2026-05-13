import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Dashboard.css";

import AdminUploadRecords from "../components/AdminUploadRecords";
import StaffRoleManager from "../components/StaffRoleManager";
import ExportPreviewModal from "../components/ExportPreviewModal";
import ctLogo from "../assets/ct-logo.png";
import { ShieldIcon, PaperclipIcon, TrashIcon, DownloadIcon } from "../components/Icons";

const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};
const ReadOnlyStars = ({ stars = 0 }) => (
  <div style={{ fontSize: "1.4rem", color: "#facc15" }}>
    {"★".repeat(stars)}
    <span style={{ color: "#cbd5e1" }}>
      {"★".repeat(5 - stars)}
    </span>
  </div>
);


function AdminDashboard() {
  const navigate = useNavigate();

  const userId = localStorage.getItem("grievance_id")?.toUpperCase();
  const isDeptAdmin = localStorage.getItem("is_dept_admin") === "true";

  const isMasterAdmin = localStorage.getItem("is_master_admin") === "true"; // 🔥 Dynamic Check
  const canManageStaff = isMasterAdmin || isDeptAdmin;

  const [activeTab, setActiveTab] = useState("triage");
  const [grievances, setGrievances] = useState([]);
  const [msg, setMsg] = useState("");
  const [statusType, setStatusType] = useState("");
  const [selectedGrievance, setSelectedGrievance] = useState(null);
  const [staffMap, setStaffMap] = useState({}); // ✅ Store Staff Names

  // ✅ FILTER STATES
  const [searchStudentId, setSearchStudentId] = useState("");
  const [searchStaffId, setSearchStaffId] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterDepartment, setFilterDepartment] = useState("All");
  const [filterMonth, setFilterMonth] = useState("");

  // ✅ EXPORT MODAL STATE
  const [showExportModal, setShowExportModal] = useState(false);



  const fetchAllGrievances = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:5000/api/grievances/all");
      if (!res.ok) throw new Error("Failed to fetch grievances");
      const data = await res.json();
      setGrievances(data);
    } catch (err) {
      setMsg(err.message);
      setStatusType("error");
    }
  }, []);

  // Fetch Staff List to Map IDs to Names
  const fetchStaffNames = useCallback(async () => {
    try {
      const token = localStorage.getItem("grievance_token"); // Get Token
      const res = await fetch("http://localhost:5000/api/admin-staff/all", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const map = {};
        data.forEach((staff) => {
          map[staff.id] = staff.fullName;
        });
        setStaffMap(map);
      }
    } catch (error) {
      console.error("Error fetching staff list:", error);
    }
  }, []);

  useEffect(() => {
    if (!isMasterAdmin && !isDeptAdmin) {
      navigate("/");
    } else {
      fetchAllGrievances();
      fetchStaffNames(); // Fetch staff details
    }
  }, [navigate, isMasterAdmin, isDeptAdmin, fetchAllGrievances, fetchStaffNames]);

  const handleLogout = () => {
    localStorage.clear();
    navigate("/");
  };

  const handleDeleteGrievance = async (id) => {
    if (!window.confirm("Are you sure you want to remove this grievance from your list?")) return;
    try {
      const token = localStorage.getItem("grievance_token");
      const res = await fetch(`http://localhost:5000/api/grievances/hide/${id}`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setGrievances(prev => prev.filter(g => g._id !== id));
        setSelectedGrievance(null);
        setMsg("✅ Grievance removed from view.");
        setStatusType("success");
        setTimeout(() => setMsg(""), 3000);
      } else {
        throw new Error("Failed to delete.");
      }
    } catch (err) {
      console.error(err);
      alert("Error removing grievance.");
    }
  };

  // ✅ FILTER LOGIC
  const filteredGrievances = grievances.filter((g) => {
    const matchStudentId = (g.userId || "").toLowerCase().includes(searchStudentId.toLowerCase());
    const matchStaffId = (g.assignedTo || "").toLowerCase().includes(searchStaffId.toLowerCase());
    const matchStatus = filterStatus === "All" || g.status === filterStatus;

    const categoryOrSchool = g.category || g.school || "";
    const matchDept = filterDepartment === "All" || categoryOrSchool === filterDepartment;

    let matchMonth = true;
    if (filterMonth) {
      const gDate = new Date(g.createdAt);
      const [year, month] = filterMonth.split("-");
      matchMonth = gDate.getFullYear() === parseInt(year) && (gDate.getMonth() + 1) === parseInt(month);
    }

    return matchStudentId && matchStaffId && matchStatus && matchDept && matchMonth;
  });
  // ✅ OPEN EXPORT PREVIEW MODAL
  const handleOpenExportModal = () => {
    setShowExportModal(true);
  };

  // ✅ EXPORT SELECTED DATA TO EXCEL
  const handleExportSelected = (selectedData, selectedColumns) => {
    const token = localStorage.getItem("grievance_token");

    // Send selected IDs and columns to backend
    fetch(`http://localhost:5000/api/grievances/export-selected`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        grievanceIds: selectedData.map((g) => g._id),
        columns: selectedColumns,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Export failed");
        return res.blob();
      })
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `grievances_export_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setMsg("✅ Export successful!");
        setStatusType("success");
        setTimeout(() => setMsg(""), 3000);
      })
      .catch(() => {
        alert("❌ Excel export failed");
      });
  };

  // ✅ Reset all filters
  const resetFilters = () => {
    setSearchStudentId("");
    setSearchStaffId("");
    setFilterStatus("All");
    setFilterDepartment("All");
    setFilterMonth("");
  };

  // ✅ Unique Departments for Dropdown
  const uniqueDepartments = [...new Set(grievances.map(g => g.category || g.school).filter(Boolean))];

  return (
    <div className="dashboard-container">
      {/* HEADER */}
      <header className="dashboard-header">
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <img src={ctLogo} alt="CT University" style={{ height: "50px" }} />
          <div className="header-content">
            <h1>Admin Dashboard</h1>
            <p>
              Welcome, <strong>{userId}</strong>
              <span className="status-badge status-resolved" style={{ marginLeft: '10px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <ShieldIcon width="14" height="14" /> Master Admin
              </span>
            </p>
          </div>
        </div>
        <button className="logout-btn-header" onClick={handleLogout}>
          Logout
        </button>
      </header>

      {/* NAV */}
      <nav className="navbar">
        <ul>
          <li
            className={activeTab === "triage" ? "active" : ""}
            onClick={() => setActiveTab("triage")}
          >
            <span className="tab-link-button">All Grievances</span>
          </li>

          <li
            className={activeTab === "upload" ? "active" : ""}
            onClick={() => setActiveTab("upload")}
          >
            <span className="tab-link-button">Export Records</span>
          </li>

          {canManageStaff && (
            <li
              className={activeTab === "staff" ? "active" : ""}
              onClick={() => setActiveTab("staff")}
            >
              <span className="tab-link-button">Manage Staff</span>
            </li>
          )}
        </ul>
      </nav>

      {/* BODY */}
      <main className="dashboard-body">
        {activeTab === "upload" && <AdminUploadRecords />}
        {activeTab === "staff" && canManageStaff && <StaffRoleManager />}

        {activeTab === "triage" && (
          <div className="card">
            <h2>All Incoming Grievances (Read Only)</h2>

            {/* ✅ FILTER BAR */
            }

            <div className="filter-bar" style={{
              display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "20px",
              padding: "15px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0"
            }}>


              <input
                type="text" placeholder="Search Student ID..."
                value={searchStudentId} onChange={(e) => setSearchStudentId(e.target.value)}
                style={{ padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", flex: "1 1 150px" }}
              />
              <input
                type="text" placeholder="Search Staff ID..."
                value={searchStaffId} onChange={(e) => setSearchStaffId(e.target.value)}
                style={{ padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", flex: "1 1 150px" }}
              />
              <select
                value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                style={{ padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", flex: "1 1 120px", cursor: "pointer" }}
              >
                <option value="All">All Status</option>
                <option value="Pending">Pending</option>
                <option value="Assigned">Assigned</option>
                <option value="Resolved">Resolved</option>
                <option value="Rejected">Rejected</option>
              </select>
              <select
                value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)}
                style={{ padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", flex: "1 1 200px", cursor: "pointer" }}
              >
                <option value="All">All Departments</option>
                {uniqueDepartments.map(dept => <option key={dept} value={dept}>{dept}</option>)}
              </select>
              <input
                type="month"
                value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}
                style={{ padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", flex: "1 1 150px", cursor: "pointer" }}
              />
              <button
                onClick={resetFilters}
                style={{ padding: "10px 20px", borderRadius: "6px", border: "none", background: "#64748b", color: "white", cursor: "pointer", fontWeight: "600" }}
              >
                Reset
              </button>
              <button
                onClick={handleOpenExportModal}
                style={{
                  padding: "10px 20px",
                  borderRadius: "6px",
                  border: "none",
                  background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: "600",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 4px 6px rgba(22, 163, 74, 0.2)",
                  transition: "all 0.2s"
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = "translateY(-2px)"}
                onMouseOut={(e) => e.currentTarget.style.transform = "translateY(0)"}
              >
                <DownloadIcon width="16" height="16" /> Export to Excel
              </button>
            </div>


            {msg && <div className={`alert-box ${statusType}`}>{msg}</div>}

            {filteredGrievances.length === 0 ? (
              <p>No grievances found matching criteria.</p>
            ) : (
              <div className="table-container">
                <table className="grievance-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Department / Category</th>
                      <th>Message</th>
                      <th>Status</th>
                      <th>Assigned Staff</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGrievances.map((g) => (
                      <tr key={g._id} onClick={() => setSelectedGrievance(g)} style={{ cursor: "pointer" }}>
                        <td data-label="ID" style={{ fontWeight: 'bold', color: '#334155' }}>{g.userId}</td>
                        <td data-label="Department / Category">{g.category || g.school || "N/A"}</td>

                        <td data-label="Message" className="message-cell" style={{ maxWidth: '200px' }}>
                          <div
                            style={{ padding: "4px", borderRadius: "4px", transition: "background 0.2s" }}
                            onMouseEnter={(e) => e.currentTarget.style.background = "#f1f5f9"}
                            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                          >
                            <span style={{ wordBreak: 'break-word', lineHeight: '1.3', color: "#334155", fontWeight: "500" }}>
                              {g.message.substring(0, 40)}{g.message.length > 40 ? "..." : ""}
                            </span>
                          </div>
                        </td>

                        <td data-label="Status">
                          <span
                            className={`status-badge status-${(g.status || "")
                              .toLowerCase()
                              .replace(" ", "")}`}
                          >
                            {g.status}
                          </span>

                          {/* ⭐ Rating under Resolved */}
                          {g.status?.toLowerCase() === "resolved" && (
                            <div style={{ marginTop: "4px", fontSize: "0.9rem" }}>
                              {g.rating?.stars ? (
                                <span style={{ color: "#facc15" }}>
                                  {"★".repeat(g.rating.stars)}
                                  <span style={{ color: "#cbd5e1" }}>
                                    {"★".repeat(5 - g.rating.stars)}
                                  </span>
                                </span>
                              ) : (
                                <span style={{ color: "#94a3b8", fontSize: "0.75rem" }}>
                                  No rating yet
                                </span>
                              )}
                            </div>
                          )}
                        </td>


                        {/* ✅ ASSIGNED STAFF COLUMN */}
                        <td data-label="Assigned Staff">
                          {g.assignedTo ? (
                            <div>
                              <span style={{ fontWeight: "600", display: "block", color: "#1e293b" }}>
                                {staffMap[g.assignedTo] || "Staff"}
                              </span>
                              <span style={{ fontSize: "0.85rem", color: "#64748b" }}>({g.assignedTo})</span>
                            </div>
                          ) : (
                            <span style={{ color: "#94a3b8", fontStyle: "italic" }}>Not Assigned Yet</span>
                          )}
                        </td>

                        <td data-label="Created">{formatDate(g.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* MODAL */}
        {selectedGrievance && (
          <div
            onClick={() => setSelectedGrievance(null)}
            style={{
              position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
              backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'white', padding: '25px', borderRadius: '12px', width: '90%', maxWidth: '500px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.2)', position: 'relative', display: 'flex', flexDirection: 'column', maxHeight: '85vh'
              }}
            >

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '15px', marginBottom: '15px' }}>
                <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.25rem' }}>Grievance Details</h3>
                <button onClick={() => setSelectedGrievance(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>&times;</button>
              </div>

              <div style={{ overflowY: 'auto', paddingRight: '5px' }}>                <p style={{ marginBottom: '10px', color: '#475569' }}><strong>Grievance ID:</strong> {selectedGrievance._id}</p>                <p style={{ marginBottom: '10px', color: '#475569' }}><strong>Category:</strong> {selectedGrievance.category || selectedGrievance.school || "N/A"}</p>
                <p style={{ marginBottom: '10px', color: '#475569' }}><strong>Date:</strong> {formatDate(selectedGrievance.createdAt)}</p>
                <p style={{ marginBottom: '10px', color: '#475569' }}><strong>Status:</strong> <span className={`status-badge status-${(selectedGrievance.status || "").toLowerCase()}`}>{selectedGrievance.status}</span></p>

                <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '10px' }}>
                  <strong style={{ display: 'block', marginBottom: '8px', color: '#334155' }}>Full Message:</strong>
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: '1.6', color: '#1e293b', wordBreak: 'break-word' }}>
                    {selectedGrievance.message}
                  </p>
                </div>

                {/* ✅ ATTACHMENT BUTTON */}
                {selectedGrievance.attachment && (
                  <div style={{ marginTop: '15px' }}>
                    <strong>Attachment: </strong>
                    <a
                      href={`http://localhost:5000/api/file/${selectedGrievance.attachment}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ color: '#2563eb', textDecoration: 'underline', fontWeight: '600' }}
                    >
                      View Document <PaperclipIcon width="14" height="14" style={{ marginLeft: '4px' }} />
                    </a>
                  </div>
                )}
              </div>
              {/* ⭐ STUDENT RATING (READ ONLY) */}
              {selectedGrievance.status === "Resolved" &&
                selectedGrievance.isRated &&
                selectedGrievance.rating && (

                  <div
                    style={{
                      marginTop: "20px",
                      padding: "15px",
                      background: "#f8fafc",
                      borderRadius: "10px",
                      border: "1px solid #e2e8f0"
                    }}
                  >
                    <h4 style={{ marginBottom: "8px", color: "#1e293b" }}>
                      ⭐ Student Feedback
                    </h4>

                    <ReadOnlyStars stars={selectedGrievance.rating.stars} />

                    {selectedGrievance.rating.feedback && (
                      <p
                        style={{
                          marginTop: "8px",
                          fontStyle: "italic",
                          color: "#475569"
                        }}
                      >
                        “{selectedGrievance.rating.feedback}”
                      </p>
                    )}

                    <p
                      style={{
                        marginTop: "6px",
                        fontSize: "0.75rem",
                        color: "#94a3b8"
                      }}
                    >
                      Rated on{" "}
                      {new Date(
                        selectedGrievance.rating.ratedAt
                      ).toLocaleDateString()}
                    </p>
                  </div>
                )}


              <div style={{ textAlign: 'right', marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #eee' }}>
                <button
                  onClick={() => setSelectedGrievance(null)}
                  style={{
                    padding: '10px 20px', backgroundColor: '#e2e8f0', border: 'none', borderRadius: '6px',
                    cursor: 'pointer', fontWeight: '600', color: '#475569', transition: 'background 0.2s'
                  }}
                  onMouseOver={(e) => e.target.style.backgroundColor = '#cbd5e1'}
                  onMouseOut={(e) => e.target.style.backgroundColor = '#e2e8f0'}
                >
                  Close
                </button>
                <button
                  onClick={() => handleDeleteGrievance(selectedGrievance._id)}
                  style={{
                    padding: '10px 20px', backgroundColor: '#fee2e2', border: '1px solid #ef4444', borderRadius: '6px',
                    cursor: 'pointer', fontWeight: '600', color: '#dc2626', transition: 'all 0.2s', marginLeft: '10px',
                    display: 'inline-flex', alignItems: 'center', gap: '5px'
                  }}
                  onMouseOver={(e) => e.target.style.backgroundColor = '#fecaca'}
                  onMouseOut={(e) => e.target.style.backgroundColor = '#fee2e2'}
                >
                  <TrashIcon width="16" height="16" /> Remove
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ✅ SUPER SMOOTH INTERACTIONS (Makhan UI) */}
        <style>{`
          .dashboard-container { animation: fadeIn 0.4s ease-out; }
          @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

          /* Smooth Transitions */
          .card, .navbar, input, select, textarea, button, .action-btn, .submit-btn, .logout-btn-header {
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1) !important;
          }

          /* Hover Effects */
          .card:hover { transform: translateY(-5px); box-shadow: 0 15px 30px rgba(0,0,0,0.1) !important; }
          
          button:hover, .action-btn:hover, .submit-btn:hover, .logout-btn-header:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
          }
          button:active, .action-btn:active { transform: scale(0.95); }

          /* Inputs */
          input:focus, select:focus, textarea:focus {
            transform: scale(1.01);
            border-color: #2563eb !important;
            box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1) !important;
          }

          /* Table */
          tr { transition: background-color 0.2s ease; }
          tr:hover { background-color: #f8fafc !important; }
        `}</style>
      </main>

      {/* EXPORT PREVIEW MODAL */}
      <ExportPreviewModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        grievances={filteredGrievances}
        staffMap={staffMap}
        onExport={handleExportSelected}
      />
    </div>
  );
}

export default AdminDashboard;
