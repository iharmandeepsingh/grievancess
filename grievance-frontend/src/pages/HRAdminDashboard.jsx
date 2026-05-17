import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "../styles/Dashboard.css";
import AssignStaffPopup from "../components/AssignStaffPopup";
import ExportPreviewModal from "../components/ExportPreviewModal";
import StaffRecordsTab from "../components/StaffRecordsTab";
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

function HRAdminDashboard() {
  const navigate = useNavigate();

  // ✅ LocalStorage se Data lo
  const role = localStorage.getItem("grievance_role")?.toLowerCase();
  const userId = localStorage.getItem("grievance_id")?.toUpperCase();
  const adminDept = localStorage.getItem("admin_department");
  const isDeptAdmin = localStorage.getItem("is_dept_admin") === "true";

  const [grievances, setGrievances] = useState([]);
  const [msg, setMsg] = useState("");
  const [statusType, setStatusType] = useState("");
  const [loading, setLoading] = useState(true);
  const [staffMap, setStaffMap] = useState({}); // ✅ Store Staff Names

  // ✅ TABS STATE
  const [activeTab, setActiveTab] = useState("grievances"); // "grievances" | "staff_records"

  // ✅ FILTER STATES
  const [searchId, setSearchId] = useState("");
  const [searchStaffId, setSearchStaffId] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [filterMonth, setFilterMonth] = useState("");

  // Popups State
  const [isAssignPopupOpen, setIsAssignPopupOpen] = useState(false);
  const [assignGrievanceId, setAssignGrievanceId] = useState(null);
  const [selectedGrievance, setSelectedGrievance] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);

  useEffect(() => {
    // ✅ Security Check: Agar banda HR ka admin nahi hai, toh bhaga do
    if (adminDept !== "HR") {
      // navigate("/"); // Development ke liye comment kiya hai, production mein on kar dena
      console.warn("Wrong Department Access");
    }

    fetchGrievances();
    fetchStaffNames(); // ✅ Fetch staff list
  }, [adminDept]);

  const fetchGrievances = async () => {
    try {
      setLoading(true);

      const category = encodeURIComponent("HR");
      const url = `http://localhost:5000/api/grievances/category/${category}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch");

      const data = await res.json();
      setGrievances(data);
    } catch (err) {
      console.error(err);
      setMsg("Failed to load grievances");
      setStatusType("error");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Fetch Staff List to Map IDs to Names
  const fetchStaffNames = async () => {
    try {
      const token = localStorage.getItem("grievance_token");
      const res = await fetch("http://localhost:5000/api/admin-staff/all", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const map = {};
        data.forEach((staff) => { map[staff.id] = staff.fullName; });
        setStaffMap(map);
      }
    } catch (error) {
      console.error("Error fetching staff list:", error);
    }
  };

  const resolveGrievance = async (id) => {
    if (!window.confirm("Resolve this grievance?")) return;
    try {
      const res = await fetch(`http://localhost:5000/api/grievances/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Resolved", resolvedBy: userId }),
      });
      if (!res.ok) throw new Error("Resolve failed");
      setMsg("✅ Grievance resolved");
      setStatusType("success");
      fetchGrievances();
    } catch (err) {
      setMsg(err.message);
      setStatusType("error");
    }
  };

  const rejectGrievance = async (g) => {
    if (!window.confirm("Are you sure you want to REJECT this grievance?")) return;
    try {
      const res = await fetch(`http://localhost:5000/api/grievances/update/${g._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Rejected", resolvedBy: userId }),
      });
      if (!res.ok) throw new Error("Reject failed");
      setMsg("✅ Grievance rejected"); setStatusType("success"); fetchGrievances();
    } catch (err) { setMsg(err.message); setStatusType("error"); }
  };

  const openAssignPopup = (id) => {
    setAssignGrievanceId(id);
    setIsAssignPopupOpen(true);
  };

  const handleAssignSuccess = (message, type) => {
    setMsg(message);
    setStatusType(type);
    fetchGrievances();
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate("/");
  };

  // ✅ EXTENSION REQUEST HANDLER
  const handleExtensionResolution = async (action) => {
    try {
      const res = await fetch(`http://localhost:5000/api/grievances/extension/resolve/${selectedGrievance._id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (res.ok) {
        setMsg(`Extension ${action}ed!`);
        setStatusType("success");
        setSelectedGrievance(null);
        fetchGrievances();
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert("Action failed");
    }
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
    const matchId = (g.userId || "").toLowerCase().includes(searchId.toLowerCase());
    const matchStaff = (g.assignedTo || "").toLowerCase().includes(searchStaffId.toLowerCase());
    const matchStatus = statusFilter === "All" || g.status === statusFilter;

    let matchMonth = true;
    if (filterMonth) {
      const gDate = new Date(g.createdAt);
      const [year, month] = filterMonth.split("-");
      matchMonth = gDate.getFullYear() === parseInt(year) && (gDate.getMonth() + 1) === parseInt(month);
    }

    return matchId && matchStaff && matchStatus && matchMonth;
  });

  const resetFilters = () => { setSearchId(""); setSearchStaffId(""); setStatusFilter("All"); setFilterMonth(""); };
  const handleOpenExportModal = () => setShowExportModal(true);
  const handleExportSelected = (selectedData, selectedColumns) => {
    const token = localStorage.getItem("grievance_token");
    fetch(`http://localhost:5000/api/grievances/export-selected`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ grievanceIds: selectedData.map((g) => g._id), columns: selectedColumns }),
    }).then((res) => { if (!res.ok) throw new Error(); return res.blob(); })
      .then((blob) => {
        const url = window.URL.createObjectURL(blob); const a = document.createElement("a");
        a.href = url; a.download = `hr_grievances_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a); a.click(); a.remove();
        setMsg("Export successful!"); setStatusType("success"); setTimeout(() => setMsg(""), 3000);
      }).catch(() => alert("Excel export failed"));
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <img src={ctLogo} alt="CT University" style={{ height: "50px" }} />
          <div className="header-content">
            <h1>HR Department</h1>
            <p>
              Welcome, <strong>{userId}</strong>
              <span className="status-badge status-assigned" style={{ marginLeft: '10px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <ShieldIcon width="14" height="14" /> HR
              </span>
            </p>
          </div>
        </div>
        <button className="logout-btn-header" onClick={handleLogout}>Logout</button>
      </header>

      <nav className="navbar">
        <ul>
          <li className="admin-nav-title"><span>HR Department </span></li>
          
          <li 
            className={activeTab === 'grievances' ? 'active' : ''} 
            onClick={() => setActiveTab('grievances')} 
            style={{ cursor: 'pointer', padding: '10px 15px', color: activeTab === 'grievances' ? '#2563eb' : '#64748b', fontWeight: activeTab === 'grievances' ? '600' : 'normal', borderBottom: activeTab === 'grievances' ? '2px solid #2563eb' : 'none' }}
          >
            Grievances
          </li>
          
          <li 
            className={activeTab === 'staff_records' ? 'active' : ''} 
            onClick={() => setActiveTab('staff_records')} 
            style={{ cursor: 'pointer', padding: '10px 15px', color: activeTab === 'staff_records' ? '#2563eb' : '#64748b', fontWeight: activeTab === 'staff_records' ? '600' : 'normal', borderBottom: activeTab === 'staff_records' ? '2px solid #2563eb' : 'none' }}
          >
            Staff Records
          </li>

          <li style={{ marginLeft: "auto" }}>
            <li><Link to="/admin/manage-staff">Manage Staff</Link></li>
            <li><Link to="/admin/smart-assignment">Smart Assignment</Link></li>
            <Link to="/admin/manage-staff" style={{ padding: "8px 16px", background: "#f1f5f9", borderRadius: "6px", color: "#334155", textDecoration: "none" }}>
              Manage Dept Staff
            </Link>
          </li>
        </ul>
      </nav>

      <main className="dashboard-body">
        {activeTab === "grievances" ? (
        <div className="card">
          <h2>Incoming Grievances</h2>
          {msg && <div className={`alert-box ${statusType}`}>{msg}</div>}

          {/* ✅ FILTER BAR */}
          <div className="filter-bar" style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "20px", padding: "15px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <input
              type="text" placeholder="Search Student ID..."
              value={searchId} onChange={(e) => setSearchId(e.target.value)}
              style={{ padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", flex: "1 1 150px" }}
            />
            <input
              type="text" placeholder="Search Staff ID..."
              value={searchStaffId} onChange={(e) => setSearchStaffId(e.target.value)}
              style={{ padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", flex: "1 1 150px" }}
            />
            <select
              value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", flex: "1 1 120px", cursor: "pointer" }}
            >
              <option value="All">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Assigned">Assigned</option>
              <option value="Resolved">Resolved</option>
              <option value="Rejected">Rejected</option>
            </select>
            <input
              type="month"
              value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}
              style={{ padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", flex: "1 1 150px", cursor: "pointer" }}
            />
            <button onClick={resetFilters} style={{ padding: "10px 20px", borderRadius: "6px", border: "none", background: "#64748b", color: "white", cursor: "pointer", fontWeight: "600" }}>Reset</button>
            <button onClick={handleOpenExportModal} style={{ padding: "10px 20px", borderRadius: "6px", border: "none", background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)", color: "white", cursor: "pointer", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px", boxShadow: "0 4px 6px rgba(22, 163, 74, 0.2)" }} onMouseOver={(e) => e.currentTarget.style.transform = "translateY(-2px)"} onMouseOut={(e) => e.currentTarget.style.transform = "translateY(0)"}><DownloadIcon width="16" height="16" /> Export</button>
          </div>

          {loading ? (
            <p>Loading...</p>
          ) : filteredGrievances.length === 0 ? (
            <div className="empty-state">
              <p>{grievances.length === 0 ? "No grievances found." : "No grievances match your filters."}</p>
            </div>
          ) : (
            <div className="table-container">
            <table className="grievance-table">
              <thead>
                <tr>
                  <th>Student ID</th>
                  <th>Name</th>
                  <th>Message</th>
                  <th>Assigned To</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredGrievances.map((g) => (
                  <tr key={g._id} onClick={() => setSelectedGrievance(g)} style={{ cursor: "pointer" }}>
                    <td style={{ fontWeight: 'bold', color: '#334155' }}>{g.userId}</td>
                    <td>{g.name}</td>
                    <td className="message-cell" style={{ maxWidth: '200px' }}>
                      <div
                        style={{ padding: "4px", borderRadius: "4px", transition: "background 0.22s" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "#f1f5f9"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        <span style={{ wordBreak: 'break-word', lineHeight: '1.3', color: "#334155", fontWeight: "500" }}>
                          {g.message.substring(0, 40)}{g.message.length > 40 ? "..." : ""}
                        </span>
                      </div>
                    </td>

                    {/* ✅ ASSIGNED TO COLUMN */}
                    <td>
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

                    <td>
                      <span className={`status-badge status-${g.status.toLowerCase()}`}>
                        {g.status}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="action-btn assign-btn"
                          onClick={(e) => { e.stopPropagation(); openAssignPopup(g._id); }}
                          disabled={g.status === "Resolved" || g.assignedTo}
                          style={{ opacity: (g.status === "Resolved" || g.assignedTo) ? 0.5 : 1, cursor: (g.status === "Resolved" || g.assignedTo) ? "not-allowed" : "pointer" }}
                        >
                          Assign
                        </button>
                        <button
                          className="action-btn resolve-btn"
                          onClick={(e) => { e.stopPropagation(); resolveGrievance(g); }} // ✅ Now passing the full object 'g'
                          disabled={g.status === "Resolved"}
                          style={{ opacity: g.status === "Resolved" ? 0.5 : 1, cursor: g.status === "Resolved" ? "not-allowed" : "pointer" }}
                        >
                          Resolve
                        </button>
                        <button
                          className="action-btn reject-btn"
                          onClick={(e) => { e.stopPropagation(); rejectGrievance(g); }}
                          disabled={g.status === "Resolved" || g.status === "Rejected"}
                          style={{ opacity: (g.status === "Resolved" || g.status === "Rejected") ? 0.5 : 1, cursor: (g.status === "Resolved" || g.status === "Rejected") ? "not-allowed" : "pointer" }}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
        ) : (
          <StaffRecordsTab />
        )}
      </main>

      {/* ✅ PROFESSIONAL DETAILS MODAL */}
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

            <div style={{ overflowY: 'auto', paddingRight: '5px' }}>
              <p style={{ marginBottom: '10px', color: '#475569' }}><strong>Grievance ID:</strong> {selectedGrievance._id}</p>
              <p style={{ marginBottom: '10px', color: '#475569' }}><strong>Student:</strong> {selectedGrievance.name} <span style={{ color: '#94a3b8' }}>({selectedGrievance.userId || selectedGrievance.regid || 'N/A'})</span></p>
              <p style={{ marginBottom: '10px', color: '#475569' }}><strong>Date:</strong> {formatDate(selectedGrievance.createdAt)}</p>
              <p style={{ marginBottom: '10px', color: '#475569' }}><strong>Status:</strong> <span className={`status-badge status-${selectedGrievance.status.toLowerCase()}`}>{selectedGrievance.status}</span></p>

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

            {/* ✅ EXTENSION REQUEST UI */}
            {selectedGrievance.extensionRequest?.status === "Pending" && (
              <div style={{ marginTop: "15px", padding: "15px", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: "8px" }}>
                <h4 style={{ margin: "0 0 10px 0", color: "#b45309", display: "flex", alignItems: "center", gap: "8px" }}>
                  ⚠️ Deadline Extension Requested
                </h4>
                <p style={{ margin: "0 0 5px 0", fontSize: "0.9rem" }}><strong>Proposed Date:</strong> {formatDate(selectedGrievance.extensionRequest.requestedDate)}</p>
                <p style={{ margin: "0 0 15px 0", fontSize: "0.9rem" }}><strong>Reason:</strong> {selectedGrievance.extensionRequest.reason}</p>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button onClick={() => handleExtensionResolution("approve")} style={{ padding: "8px 16px", background: "#16a34a", color: "white", border: "none", borderRadius: "6px", fontSize: "0.9rem", fontWeight: "600", cursor: "pointer" }}>Approve Extension</button>
                  <button onClick={() => handleExtensionResolution("reject")} style={{ padding: "8px 16px", background: "#ef4444", color: "white", border: "none", borderRadius: "6px", fontSize: "0.9rem", fontWeight: "600", cursor: "pointer" }}>Reject</button>
                </div>
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

      <AssignStaffPopup
        isOpen={isAssignPopupOpen}
        onClose={() => setIsAssignPopupOpen(false)}
        department="HR"
        grievanceId={assignGrievanceId}
        adminId={userId}
        onAssigned={handleAssignSuccess}
      />
      <ExportPreviewModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} grievances={filteredGrievances} staffMap={staffMap} onExport={handleExportSelected} />

      {/* ✅ SUPER SMOOTH INTERACTIONS (Makhan UI) */}
      <style>{`
        .dashboard-container { animation: fadeIn 0.4s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        /* Smooth Transitions */
        .card, .navbar, input, select, textarea, button, .action-btn, .submit-btn, .logout-btn-header {
          transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1) !important;
        }

        /* Hover Effects */
        .card:hover { box-shadow: 0 15px 30px rgba(0,0,0,0.1) !important; }
        
        button:hover, .action-btn:hover, .submit-btn:hover, .logout-btn-header:hover {
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        button:active, .action-btn:active { transform: scale(0.95); }

        /* Reject Button Style */
        .reject-btn { background-color: #fef2f2; color: #dc2626; border: 1px solid #fee2e2; }
        .reject-btn:hover {
          background-color: #dc2626; color: white; border-color: #dc2626;
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(220, 38, 38, 0.2);
        }

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
    </div>
  );
}

export default HRAdminDashboard;