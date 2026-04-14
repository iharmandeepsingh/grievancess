import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Dashboard.css";
import ctLogo from "../assets/ct-logo.png";
import { ClipboardIcon, PaperclipIcon, TrashIcon } from "../components/Icons";

// Helper: format dates for tables
const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  const options = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };
  return new Date(dateString).toLocaleDateString("en-US", options);
};

const schools = [
  "School of Engineering and Technology",
  "School of Management Studies",
  "School of Law",
  "School of Pharmaceutical Sciences",
  "School of Hotel Management",
  "School of Design and innovation",
  "School of Allied Health Sciences",
  "School of Social Sciences and Liberal Arts"
];

function StaffDashboard() {
  const navigate = useNavigate();
  const role = localStorage.getItem("grievance_role");
  const userId = localStorage.getItem("grievance_id"); // e.g. STF001

  // UI State
  const [activeTab, setActiveTab] = useState("submit"); // "submit" | "mine"

  // Staff Info
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffDept, setStaffDept] = useState("");

  // Form Data for submitting grievance as staff
  const [formData, setFormData] = useState({
    name: "",
    staffId: userId || "",
    email: "",
    department: "", // Stores selected School
    message: "",
  });

  const [attachment, setAttachment] = useState(null); // ✅ Added Attachment State
  const [msg, setMsg] = useState("");
  const [statusType, setStatusType] = useState("");
  const [errors, setErrors] = useState({});

  // Data for tables
  const [myGrievances, setMyGrievances] = useState([]);

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingMine, setLoadingMine] = useState(true);

  // ✅ FILTER STATES
  const [searchStaffId, setSearchStaffId] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterDepartment, setFilterDepartment] = useState("All");
  const [filterMonth, setFilterMonth] = useState("");

  // ✅ State for "See More" Details Popup
  const [selectedGrievance, setSelectedGrievance] = useState(null);

  // Route protection
  useEffect(() => {
    if (!role || role !== "staff") navigate("/");
  }, [role, navigate]);

  // Fetch staff profile
  useEffect(() => {
    const fetchStaffDetails = async () => {
      if (!userId) {
        setLoadingProfile(false);
        return;
      }
      try {
        const res = await fetch(`http://localhost:5000/api/auth/user/${userId}`);
        const data = await res.json();
        if (res.ok) {
          setStaffName(data.fullName || userId);
          setStaffEmail(data.email || "");
          setStaffDept(data.department || "");
          setFormData((prev) => ({
            ...prev,
            name: data.fullName || "",
            email: data.email || "",
            department: data.department || "",
          }));
        } else {
          setStaffName(userId);
        }
      } catch (err) {
        console.error("Error fetching staff profile:", err);
        setStaffName(userId);
      } finally {
        setLoadingProfile(false);
      }
    };
    fetchStaffDetails();
  }, [userId]);

  // Fetch grievances submitted by this staff
  const fetchMyGrievances = async () => {
    if (!userId) return;
    setLoadingMine(true);
    try {
      const res = await fetch(`http://localhost:5000/api/grievances/user/${userId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch my grievances");
      // preserve scroll
      const prevScrollY = window.scrollY || window.pageYOffset;
      setMyGrievances(data);
      requestAnimationFrame(() => window.scrollTo(0, prevScrollY));
    } catch (err) {
      console.error("Error fetching my grievances:", err);
      setMsg("Failed to load your submitted grievances");
      setStatusType("error");
    } finally {
      setLoadingMine(false);
    }
  };

  // Initial load of my grievances
  useEffect(() => {
    fetchMyGrievances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Validation for form fields (submit grievance)
  const validateField = (name, value) => {
    let error = "";
    if (!value) {
      error = "This field is required";
    } else if (name === "email" && !/\S+@\S+\.\S+/.test(value)) {
      error = "Email address is invalid";
    }
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    validateField(name, value);
  };

  const handleFileChange = (e) => {
    setAttachment(e.target.files[0]);
  };

  const validateForm = () => {
    const newErrors = {};
    Object.keys(formData).forEach((key) => {
      if (!formData[key]) {
        newErrors[key] = "This field is required";
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

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
        setMyGrievances(prev => prev.filter(g => g._id !== id));
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

  // Submit grievance as staff
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      setMsg("Please fill out all required fields.");
      setStatusType("error");
      return;
    }

    setMsg("Submitting your grievance...");
    setStatusType("info");

    // 1️⃣ Upload File to MongoDB (GridFS) First
    let attachmentUrl = "";
    if (attachment) {
      const fileData = new FormData();
      fileData.append("file", attachment);
      try {
        const uploadRes = await fetch("http://localhost:5000/api/upload", { method: "POST", body: fileData });
        if (!uploadRes.ok) throw new Error("File upload failed");
        const uploadJson = await uploadRes.json();
        attachmentUrl = uploadJson.filename;
      } catch (err) {
        setMsg(`❌ Upload Error: ${err.message}`); setStatusType("error"); return;
      }
    }

    try {
      const res = await fetch("http://localhost:5000/api/grievances/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          name: formData.name,
          email: formData.email,
          phone: "",
          regid: formData.staffId,
          school: formData.department, // Selected School
          category: formData.department, // Routes to School Admin
          message: formData.message,
          studentProgram: "Staff Member", // Required by backend
          attachment: attachmentUrl || "" // ✅ Send filename
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Submission failed");

      setMsg("Grievance submitted successfully!");
      setStatusType("success");

      setFormData((prev) => ({
        ...prev,
        message: "",
      }));
      setErrors({});
      setAttachment(null);
      if (document.getElementById("staffFileInput")) document.getElementById("staffFileInput").value = "";

      fetchMyGrievances();
    } catch (err) {
      setMsg(`Error: ${err.message}`);
      setStatusType("error");
    }
  };

  const handleUpdateAssignedStatus = async (id, newStatus) => {
    setMsg("Updating grievance status...");
    setStatusType("info");

    const body = { status: newStatus };
    if (newStatus === "Resolved") {
      body.resolvedBy = userId;
    }

    try {
      const res = await fetch(`http://localhost:5000/api/grievances/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update");

      setMsg("Grievance updated successfully!");
      setStatusType("success");

      fetchMyGrievances();
    } catch (err) {
      console.error("Error updating assigned grievance:", err);
      setMsg(`Error: ${err.message}`);
      setStatusType("error");
    }
  };

  // ✅ FILTER LOGIC
  const filteredMyGrievances = myGrievances.filter((g) => {
    const matchStaff = (g.assignedTo || "").toLowerCase().includes(searchStaffId.toLowerCase());
    const matchStatus = filterStatus === "All" || g.status === filterStatus;
    const matchDept = filterDepartment === "All" || (g.category || g.school || "") === filterDepartment;

    let matchMonth = true;
    if (filterMonth) {
      const gDate = new Date(g.createdAt);
      const [year, month] = filterMonth.split("-");
      matchMonth = gDate.getFullYear() === parseInt(year) && (gDate.getMonth() + 1) === parseInt(month);
    }

    return matchStaff && matchStatus && matchDept && matchMonth;
  });

  // ✅ Unique Departments for Dropdown
  const uniqueDepartments = [...new Set(myGrievances.map(g => g.category || g.school).filter(Boolean))];



  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <img src={ctLogo} alt="CT University" style={{ height: "50px" }} />
          <div className="header-content">
            <h1>Staff Dashboard</h1>
            <p>
              {loadingProfile
                ? "Loading your profile..."
                : <>Welcome, <strong>{staffName || userId}</strong> {staffDept && (
                  <span className="status-badge status-assigned" style={{ marginLeft: '10px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <ClipboardIcon width="14" height="14" /> {staffDept}
                  </span>
                )}</>}
            </p>
          </div>
        </div>
        <button className="logout-btn-header" onClick={handleLogout}>
          Logout
        </button>
      </header>

      {/* ✅ FIXED NAVBAR TABS (Glass Pill Style) */}
      <nav className="navbar">
        <ul>
          <li className={activeTab === "submit" ? "active" : ""}>
            <button
              className="tab-link-button"
              onClick={() => setActiveTab("submit")}
            >
              Submit Grievance
            </button>
          </li>
          <li className={activeTab === "mine" ? "active" : ""}>
            <button
              className="tab-link-button"
              onClick={() => setActiveTab("mine")}
            >
              My Submissions
            </button>
          </li>
        </ul>
      </nav>

      <main className="dashboard-body">
        <div className="card">
          {msg && <div className={`alert-box ${statusType}`}>{msg}</div>}

          {/* TAB 1: Submit Grievance */}
          {activeTab === "submit" && (
            <>
              <h2>Submit Staff Grievance</h2>
              <p>Select the relevant School/Department and describe your issue. It will be routed to the Head of Department.</p>

              <form onSubmit={handleSubmit} noValidate>
                <div className="form-row">
                  <div className="input-group">
                    <label>Full Name</label>
                    <input type="text" name="name" value={formData.name} readOnly className="read-only-input" />
                  </div>

                  <div className="input-group">
                    <label>Staff ID</label>
                    <input type="text" name="staffId" value={formData.staffId} readOnly className="read-only-input" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="input-group">
                    <label>Email</label>
                    <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="you@college.edu" />
                  </div>
                </div>

                {/* ✅ SCHOOL SELECTION DROPDOWN */}
                <div className="input-group">
                  <label>Select School / Department</label>
                  <select name="department" value={formData.department} onChange={handleChange} required>
                    <option value="">-- Select School --</option>
                    {schools.map((school) => <option key={school} value={school}>{school}</option>)}
                  </select>
                  {errors.department && <p className="error-text">{errors.department}</p>}
                </div>

                <div className="input-group">
                  <label>Message / Query</label>
                  <textarea name="message" value={formData.message} onChange={handleChange} placeholder="Describe your issue..." rows="5"></textarea>
                  {errors.message && <p className="error-text">{errors.message}</p>}
                </div>

                <div className="input-group">
                  <label>Attach Document (Optional)</label>
                  <input
                    id="staffFileInput"
                    type="file"
                    onChange={handleFileChange}
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="file-input"
                  />
                </div>

                <button type="submit" className="submit-btn">Submit Grievance</button>
              </form>
            </>
          )}

          {/* TAB 2: My Submissions */}
          {activeTab === "mine" && (
            <>
              <h2>My Submitted Grievances</h2>
              <p>These are grievances you have submitted as staff.</p>

              {/* ✅ FILTER BAR */}
              <div className="filter-bar" style={{
                display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "20px",
                padding: "15px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0"
              }}>
                <input
                  type="text" placeholder="Search Assigned Staff ID..."
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
                  style={{ padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", flex: "1 1 150px", cursor: "pointer" }}
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
                  onClick={() => {
                    setSearchStaffId(""); setFilterStatus("All"); setFilterDepartment("All"); setFilterMonth("");
                  }}
                  style={{ padding: "10px 20px", borderRadius: "6px", border: "none", background: "#64748b", color: "white", cursor: "pointer", fontWeight: "600" }}
                >
                  Reset
                </button>
              </div>

              {loadingMine ? (
                <p>Loading your grievances...</p>
              ) : filteredMyGrievances.length === 0 ? (
                <div className="empty-state"><p>{myGrievances.length === 0 ? "You have not submitted any grievances yet." : "No grievances match your filters."}</p></div>
              ) : (
                <div className="table-container">
                  <table className="grievance-table">
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>Message</th>
                        <th>Status</th>
                        <th>Assigned To</th>
                        <th>Submitted At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMyGrievances.map((g) => (
                        <tr key={g._id} onClick={() => setSelectedGrievance(g)} style={{ cursor: "pointer" }}>
                          <td>{g.category}</td>

                          {/* --- FIXED MESSAGE CELL (Max Width 150px + See More) --- */}
                          <td className="message-cell" style={{ maxWidth: '150px' }}>
                            <div
                              style={{ padding: "4px", borderRadius: "4px", transition: "background 0.22s" }}
                              onMouseEnter={(e) => e.currentTarget.style.background = "#f1f5f9"}
                              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                            >
                              <span style={{ wordBreak: 'break-all', lineHeight: '1.2', color: "#334155", fontWeight: "500" }}>
                                {g.message.substring(0, 30)}{g.message.length > 30 ? "..." : ""}
                              </span>
                            </div>
                          </td>
                          {/* ---------------------------------------------------- */}

                          <td>
                            <span className={`status-badge status-${g.status.toLowerCase()}`}>
                              {g.status}
                            </span>
                          </td>
                          <td>{g.assignedTo || "Not Assigned"}</td>
                          <td>{formatDate(g.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* --- DETAILS POPUP MODAL (Fixed for Long Text) --- */}
      {selectedGrievance && (
        <div
          onClick={() => setSelectedGrievance(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
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

            <div style={{ overflowY: 'auto', paddingRight: '5px' }}>`r`n                <p style={{ marginBottom: '10px', color: '#475569' }}><strong>Grievance ID:</strong> {selectedGrievance._id}</p>`r`n                <p style={{ marginBottom: '10px', color: '#475569' }}><strong>Category:</strong> {selectedGrievance.category}</p>

              {selectedGrievance.name && (
                <p style={{ marginBottom: '10px', color: '#475569' }}><strong>Submitted By:</strong> {selectedGrievance.name}</p>
              )}

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
        .card, .navbar, input, select, textarea, button, .action-btn, .submit-btn, .logout-btn-header, .logout-floating {
          transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1) !important;
        }

        /* Hover Effects */
        .card:hover { transform: translateY(-5px); box-shadow: 0 15px 30px rgba(0,0,0,0.1) !important; }
        
        button:hover, .action-btn:hover, .submit-btn:hover, .logout-btn-header:hover, .logout-floating:hover {
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
    </div>
  );
}

export default StaffDashboard;