import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import "../styles/Dashboard.css";
// ✅ ChatPopup Import
import ChatPopup from "../components/ChatPopup";
import Verifications from "../components/Verifications";
import ctLogo from "../assets/ct-logo.png";
import {
  BellIcon, GraduationCapIcon, ChartBarIcon, ClockIcon, CheckCircleIcon,
  AlertCircleIcon, PaperclipIcon, MessageCircleIcon, TrashIcon
} from "../components/Icons";


// ✅ HELPER FUNCTION
const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric"
  });
};

function StudentDashboard() {
  const navigate = useNavigate();
  const userId = localStorage.getItem("grievance_id");
  const role = localStorage.getItem("grievance_role");

  // ✅ STATE FOR POPUP & DATA
  const [selectedGrievance, setSelectedGrievance] = useState(null);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, resolved: 0, rejected: 0 });
  const [msg, setMsg] = useState("");
  const [statusType, setStatusType] = useState(""); // success | error
  const [loading, setLoading] = useState(true);


  const handleDeleteGrievance = async (id) => {
    if (!window.confirm("Are you sure you want to remove this grievance from your list?")) return;
    try {
      const token = localStorage.getItem("grievance_token");
      const res = await fetch(`http://localhost:5000/api/grievances/hide/${id}`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setHistory(prev => prev.filter(g => g._id !== id));
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

  // ✅ User Details State
  const [studentName, setStudentName] = useState("");
  const [studentDept, setStudentDept] = useState(""); // 🔥 Department State Added
  const [staffMap, setStaffMap] = useState({}); // ✅ Store Staff Names for "Assigned To"

  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatGrievanceId, setChatGrievanceId] = useState(null);

  // --- NOTIFICATION STATE ---
  const [unreadMap, setUnreadMap] = useState({});
  const [toast, setToast] = useState({ show: false, message: "" });
  const lastMessageRef = useRef({});
  const isFirstPoll = useRef(true);

  // ✅ FILTER STATES
  const [searchStaffId, setSearchStaffId] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [isVerificationPopupOpen, setIsVerificationPopupOpen] = useState(false);
  const [filterDepartment, setFilterDepartment] = useState("All");

  const [filterMonth, setFilterMonth] = useState("");

  const [activeTab, setActiveTab] = useState("activity"); // 'activity' | 'verifications'
  // ⭐ Rating State
  const [ratingStars, setRatingStars] = useState(0);
  const [ratingFeedback, setRatingFeedback] = useState("");
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

  useEffect(() => {
    if (selectedGrievance) {
      setRatingStars(0);
      setRatingFeedback("");
    }
  }, [selectedGrievance]);

  useEffect(() => {
    if (!role || role !== "student") navigate("/");
  }, [role, navigate]);

  // Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. User Info Fetch
        const userRes = await fetch(`http://localhost:5000/api/auth/user/${userId}`);
        const userData = await userRes.json();

        if (userRes.ok) {
          setStudentName(userData.fullName);
          // ✅ Ab server se 'department' sahi aa raha hai
          setStudentDept(userData.department);
        }

        // 2. Grievance History
        const histRes = await fetch(`http://localhost:5000/api/grievances/user/${userId}`);
        const histData = await histRes.json();

        if (histRes.ok) {
          setHistory(histData);

          // Stats Calculation
          const total = histData.length;
          const resolved = histData.filter(g => g.status === "Resolved").length;
          const rejected = histData.filter(g => g.status === "Rejected").length;
          const pending = total - resolved - rejected;

          setStats({ total, resolved, rejected, pending });
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    if (userId) fetchData();
    fetchStaffNames(); // ✅ Fetch staff list
  }, [userId]);

  // ✅ Fetch Staff List to Map IDs to Names
  const fetchStaffNames = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/admin-staff/all");
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

  // --- LIVE POLLING FOR NOTIFICATIONS ---
  useEffect(() => {
    if (!userId || history.length === 0) return;

    const pollMessages = async () => {
      const newUnreadMap = { ...unreadMap };
      let newToastMsg = null;

      await Promise.all(history.map(async (g) => {
        try {
          const res = await fetch(`http://localhost:5000/api/chat/${g._id}`);
          if (res.ok) {
            const msgs = await res.json();

            if (msgs.length > 0) {
              const lastMsg = msgs[msgs.length - 1];

              // If sender is NOT student (so it is staff/admin), then it's unread for student
              const isStaffSender = (lastMsg.senderRole !== "student" && lastMsg.senderId !== userId);

              // A. Red Dot Logic
              if (isChatOpen && chatGrievanceId === g._id) {
                newUnreadMap[g._id] = false;
              } else {
                newUnreadMap[g._id] = isStaffSender;
              }

              // B. Toast Logic
              if (lastMessageRef.current[g._id] !== lastMsg._id) {
                if (!isFirstPoll.current && isStaffSender) {
                  newToastMsg = `New message on grievance regarding ${g.category}`;
                }
                lastMessageRef.current[g._id] = lastMsg._id;
              }
            }
          }
        } catch (err) {
          console.warn("Polling error for", g._id);
        }
      }));

      setUnreadMap(newUnreadMap);

      if (newToastMsg) {
        showToastNotification(newToastMsg);
      }

      isFirstPoll.current = false;
    };

    const intervalId = setInterval(pollMessages, 5000);
    pollMessages(); // Run once immediately

    return () => clearInterval(intervalId);
  }, [history, userId, isChatOpen, chatGrievanceId]);

  const showToastNotification = (message) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: "" }), 3000);
  };

  const openChat = (gId) => {
    setChatGrievanceId(gId);
    setIsChatOpen(true);
    // Remove red dot immediately
    setUnreadMap(prev => ({ ...prev, [gId]: false }));
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate("/");
  };

  // ✅ FILTER LOGIC
  const filteredHistory = history.filter((g) => {
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
  const uniqueDepartments = [...new Set(history.map(g => g.category || g.school).filter(Boolean))];

  // Graph Percentages
  const totalG = stats.total || 1;
  const resolvedPct = (stats.resolved / totalG) * 100;
  const pendingPct = (stats.pending / totalG) * 100;
  const rejectedPct = (stats.rejected / totalG) * 100;

  // Inline Styles for Graph (Clean & Professional)
  const graphStyles = {
    statsContainer: {
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px', width: '100%'
    },
    statCard: {
      background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
    },
    statIcon: {
      width: '50px', height: '50px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem'
    },
    graphSection: {
      background: 'white', padding: '25px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '30px', width: '100%', boxSizing: 'border-box'
    },
    barGroup: { display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' },
    barTrack: { flex: 1, height: '12px', background: '#f1f5f9', borderRadius: '6px', overflow: 'hidden' },
    barLabel: { width: '100px', fontWeight: '500', color: '#64748b', fontSize: '0.9rem' }
  };
  const StarRating = ({ value, onChange }) => (
    <div style={{ fontSize: "1.8rem", marginBottom: "10px" }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          onClick={() => onChange(star)}
          style={{
            cursor: "pointer",
            color: star <= value ? "#facc15" : "#cbd5e1",
            transition: "0.2s"
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
  const submitRating = async () => {
    if (ratingStars === 0) return alert("Please select a rating");

    try {
      setRatingSubmitting(true);
      const token = localStorage.getItem("grievance_token");

      const res = await fetch(
        `http://localhost:5000/api/grievances/rate/${selectedGrievance._id}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            stars: ratingStars,
            feedback: ratingFeedback
          }),
        }
      );

      const data = await res.json();

      if (res.ok) {
        alert("⭐ Thank you for your feedback!");
        setHistory(prev =>
          prev.map(g =>
            g._id === selectedGrievance._id
              ? { ...g, isRated: true, rating: { stars: ratingStars } }
              : g
          )
        );
        setSelectedGrievance(null);
      } else {
        alert(data.message || "Rating failed");
      }
    } catch (err) {
      alert("Error submitting rating");
    } finally {
      setRatingSubmitting(false);
    }
  };
  const fetchGrievanceHistory = async () => {
    try {
      const res = await fetch(
        `http://localhost:5000/api/grievances/user/${userId}`
      );
      const data = await res.json();

      if (res.ok) {
        setHistory(data);

        // 🔥 IMPORTANT: recompute stats
        const total = data.length;
        const resolved = data.filter(g => g.status === "Resolved").length;
        const rejected = data.filter(g => g.status === "Rejected").length;
        const pending = total - resolved - rejected;

        setStats({ total, resolved, rejected, pending });
      }
    } catch (err) {
      console.error("Failed to refresh grievance history", err);
    }
  };





  return (
    <div className="dashboard-container">

      {/* Toast Notification */}
      {toast.show && (
        <div className="toast-notification">
          <span><BellIcon width="16" height="16" /></span>
          {toast.message}
        </div>
      )}

      <header className="dashboard-header">
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <img src={ctLogo} alt="CT University" style={{ height: "50px" }} />
          <div className="header-content">
            <h1>Student Dashboard</h1>
            <p>
              Welcome back, <strong>{studentName || userId}</strong>
              {/* ✅ Department Badge added here */}
              {studentDept && (
                <span className="status-badge status-assigned" style={{ marginLeft: '10px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <GraduationCapIcon width="14" height="14" /> {studentDept}
                </span>
              )}
            </p>
          </div>
        </div>
        <button className="logout-btn-header" onClick={handleLogout}>Logout</button>
      </header>

      {/* ✅ NAVBAR */}
      <nav className="navbar">
        <ul>
          <li className="active"><Link to="/student/dashboard">Dashboard</Link></li>
          <li><Link to="/student/welfare">Student Welfare</Link></li>
          <li><Link to="/student/admission">Admission</Link></li>
          <li><Link to="/student/section">Student Section</Link></li>
          <li><Link to="/student/accounts">Accounts</Link></li>
          <li><Link to="/student/examination">Examination</Link></li>
          <li><Link to="/student/department">Department</Link></li>
          <li><Link to="/student/hr">HR</Link></li>
          <li><Link to="/student/crc">CRC (Placement)</Link></li>
          <li><Link to="/student/transport">Transport</Link></li>
        </ul>
      </nav>

      <main className="dashboard-body">

        {/* ✅ 1. STATS OVERVIEW CARDS */}
        <div style={graphStyles.statsContainer}>
          <div style={graphStyles.statCard}>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#64748b', textTransform: 'uppercase' }}>Total Grievances</h3>
              <p style={{ margin: '5px 0 0', fontSize: '2rem', fontWeight: 700, color: '#1e293b' }}>{stats.total}</p>
            </div>
            <div style={{ ...graphStyles.statIcon, background: '#eff6ff', color: '#2563eb' }}><ChartBarIcon width="24" height="24" /></div>
          </div>

          <div style={graphStyles.statCard}>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#64748b', textTransform: 'uppercase' }}>Pending</h3>
              <p style={{ margin: '5px 0 0', fontSize: '2rem', fontWeight: 700, color: '#1e293b' }}>{stats.pending}</p>
            </div>
            <div style={{ ...graphStyles.statIcon, background: '#fff7ed', color: '#ea580c' }}><ClockIcon width="24" height="24" /></div>
          </div>

          <div style={graphStyles.statCard}>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#64748b', textTransform: 'uppercase' }}>Resolved</h3>
              <p style={{ margin: '5px 0 0', fontSize: '2rem', fontWeight: 700, color: '#1e293b' }}>{stats.resolved}</p>
            </div>
            <div style={{ ...graphStyles.statIcon, background: '#f0fdf4', color: '#16a34a' }}><CheckCircleIcon width="24" height="24" /></div>
          </div>
        </div>

        {/* ✅ 2. GRAPH / VISUAL REPRESENTATION */}
        {stats.total > 0 && (
          <div style={graphStyles.graphSection}>
            <h2 style={{ margin: '0 0 20px', fontSize: '1.2rem', color: '#1e293b' }}>Resolution Status</h2>

            {/* Resolved Bar */}
            <div style={graphStyles.barGroup}>
              <span style={graphStyles.barLabel}>Resolved</span>
              <div style={graphStyles.barTrack}>
                <div style={{ height: '100%', width: `${resolvedPct}%`, background: '#10b981', borderRadius: '6px', transition: 'width 0.5s' }}></div>
              </div>
              <span style={{ fontWeight: 600, color: '#334155', width: '40px', textAlign: 'right' }}>{stats.resolved}</span>
            </div>

            {/* Pending Bar */}
            <div style={graphStyles.barGroup}>
              <span style={graphStyles.barLabel}>Pending</span>
              <div style={graphStyles.barTrack}>
                <div style={{ height: '100%', width: `${pendingPct}%`, background: '#f59e0b', borderRadius: '6px', transition: 'width 0.5s' }}></div>
              </div>
              <span style={{ fontWeight: 600, color: '#334155', width: '40px', textAlign: 'right' }}>{stats.pending}</span>
            </div>

            {/* Rejected Bar */}
            <div style={graphStyles.barGroup}>
              <span style={graphStyles.barLabel}>Rejected</span>
              <div style={graphStyles.barTrack}>
                <div style={{ height: '100%', width: `${rejectedPct}%`, background: '#ef4444', borderRadius: '6px', transition: 'width 0.5s' }}></div>
              </div>
              <span style={{ fontWeight: 600, color: '#334155', width: '40px', textAlign: 'right' }}>{stats.rejected}</span>
            </div>
          </div>
        )}

        {/* ✅ TAB SWITCHER (Makhan UI) */}
        <div className="dashboard-tabs">
          <button
            onClick={() => setActiveTab('activity')}
            className={`tab-btn ${activeTab === 'activity' ? 'active' : ''}`}
          >
            Recent Activity
          </button>

          <button
            onClick={() => setActiveTab('verifications')}
            className={`tab-btn tab-verifications ${activeTab === 'verifications' ? 'active' : ''}`}
          >
            Verifications
            {history.filter(g => g.status === 'Verification').length > 0 && (
              <span className="badge-count">
                {history.filter(g => g.status === 'Verification').length}
              </span>
            )}
          </button>
        </div>

        {/* ✅ TAB CONTENT */}
        {activeTab === 'verifications' ? (
          <Verifications
            history={history}
            onOpenModal={(g) => { setSelectedGrievance(g); setIsVerificationPopupOpen(true); }}
          />
        ) : (
          <div className="card">
            <h2>Recent Activity</h2>

            {/* ✅ FILTER BAR */}
            <div className="mobile-filter-bar filter-bar" style={{
              display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "20px",
              padding: "15px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0"
            }}>
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

            {loading ? (
              <p>Loading records...</p>
            ) : filteredHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', border: '1px dashed #cbd5e1', borderRadius: '12px' }}>
                <h3>No grievances found</h3>
                <p>{history.length === 0 ? "You haven't submitted any grievances yet." : "No grievances match your filters."}</p>
                {history.length === 0 && (
                  <button
                    style={{ marginTop: '15px', padding: '10px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                    onClick={() => navigate('/student/welfare')}
                  >
                    Submit a Grievance
                  </button>
                )}
              </div>
            ) : (
              <div className="table-container">
                <table className="grievance-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Category / School</th>
                      <th>Message</th>
                      <th>Status</th>
                      <th>Assigned To</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map((g) => (
                      <tr key={g._id} onClick={() => setSelectedGrievance(g)} style={{ cursor: "pointer" }}>
                        <td>{formatDate(g.createdAt)}</td>
                        <td>{g.category || "General"}</td>

                        {/* --- FIXED MESSAGE CELL (Max Width 150px) --- */}
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
                        {/* ------------------------------------------- */}

                        <td>
                          <span className={`status-badge status-${g.status.toLowerCase().replace(" ", "")}`}>
                            {g.status}
                          </span>
                        </td>

                        {/* ✅ ASSIGNED TO COLUMN */}
                        <td>
                          {g.assignedTo ? (
                            <span style={{ fontWeight: "500", color: "#1e293b" }}>
                              {staffMap[g.assignedTo] || "Staff"} <span style={{ fontSize: '0.85rem', color: '#64748b' }}>({g.assignedTo})</span>
                            </span>
                          ) : (
                            <span style={{ color: "#94a3b8", fontStyle: "italic" }}>Yet to assign</span>
                          )}
                        </td>

                        <td>
                          <div className="chat-btn-wrapper">
                            <button
                              className="action-btn"
                              style={{ backgroundColor: "#3b82f6", color: "white" }}
                              onClick={(e) => { e.stopPropagation(); openChat(g._id); }}
                            >
                              Chat
                            </button>
                            {/* 🔴 RED DOT */}
                            {unreadMap[g._id] && (
                              <span className="notification-dot"></span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* --- DETAILS POPUP MODAL --- */}
        {selectedGrievance && (
          <div
            onClick={() => setSelectedGrievance(null)}
            style={{
              position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
              backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
              justifyContent: 'center', alignItems: 'center', zIndex: 1000
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
                <p style={{ marginBottom: '10px', color: '#475569' }}><strong>Category:</strong> {selectedGrievance.category || selectedGrievance.school || "General"}</p>
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
                {/* ⭐ RATING SECTION */}
                {selectedGrievance.status === "Resolved" && (
                  <div style={{
                    marginTop: "20px",
                    paddingTop: "15px",
                    borderTop: "1px solid #e2e8f0"
                  }}>
                    <h4 style={{ marginBottom: "8px", color: "#1e293b" }}>
                      Rate this Resolution
                    </h4>

                    {selectedGrievance.isRated ? (
                      <div style={{ color: "#facc15", fontSize: "1.4rem" }}>
                        {"★".repeat(selectedGrievance.rating?.stars || 0)}
                        <span style={{ color: "#64748b", fontSize: "0.9rem", marginLeft: "8px" }}>
                          (Already rated)
                        </span>
                      </div>
                    ) : (
                      <>
                        <StarRating value={ratingStars} onChange={setRatingStars} />

                        <textarea
                          placeholder="Optional feedback..."
                          value={ratingFeedback}
                          onChange={(e) => setRatingFeedback(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "10px",
                            borderRadius: "8px",
                            border: "1px solid #cbd5e1",
                            marginBottom: "10px"
                          }}
                        />

                        <button
                          onClick={submitRating}
                          disabled={ratingSubmitting}
                          style={{
                            padding: "10px 20px",
                            background: "#facc15",
                            color: "#78350f",
                            border: "none",
                            borderRadius: "8px",
                            fontWeight: "600",
                            cursor: "pointer"
                          }}
                        >
                          {ratingSubmitting ? "Submitting..." : "Submit Rating"}
                        </button>
                      </>
                    )}
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

      </main>

      {/* ✅ Chat Popup Component */}
      < ChatPopup
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        grievanceId={chatGrievanceId}
        currentUserId={userId}
        currentUserRole="student"
      />

      {/* 🔥 VERIFICATION POPUP (Glassmorphism) */}
      {isVerificationPopupOpen && selectedGrievance && (
        <VerificationModal
          grievance={selectedGrievance}
          onClose={() => {
            setIsVerificationPopupOpen(false);
            setSelectedGrievance(null);
          }}
          onVerify={async (id, action, feedback) => {
            try {
              const token = localStorage.getItem("grievance_token");

              const res = await fetch(
                `http://localhost:5000/api/grievances/verify-resolution/${id}`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ action, feedback }),
                }
              );

              const data = await res.json();

              if (!res.ok) {
                alert(data.message || "Verification failed");
                // ✅ FORCE STATE UPDATE USING BACKEND RESPONSE
                setHistory(prev =>
                  prev.map(g =>
                    g._id === data.grievance._id ? data.grievance : g
                  )
                );

                // ✅ Close modal
                setIsVerificationPopupOpen(false);
                setSelectedGrievance(null);

                return;
              }

              // 🔥 THIS IS THE KEY LINE
              // ✅ Update history instantly from backend response
              setHistory(prev =>
                prev.map(g =>
                  g._id === data.grievance._id ? data.grievance : g
                )
              );

              // ✅ ALSO update selected grievance
              setSelectedGrievance(data.grievance);

              setIsVerificationPopupOpen(false);

              alert("Grievance Closed! Thank you.");
            } catch (err) {
              console.error(err);
              alert("Server error while verifying grievance");
            }
          }}
        />
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
    </div >
  );
}


// ✅ VERIFICATION MODAL COMPONENT (Internal)

function VerificationModal({ grievance, onVerify, onClose }) {
  const [feedback, setFeedback] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const isLastAttempt = (grievance.verificationAttempts || 0) >= 1;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)',
      display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999,
      animation: 'fadeIn 0.3s ease-out'
    }}>
      <div style={{
        background: 'white', padding: '30px', borderRadius: '24px',
        width: '90%', maxwidth: '450px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        textAlign: 'center', position: 'relative', border: '1px solid rgba(255,255,255,0.8)',
        animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>

        {/* ❌ CLOSE BUTTON */}
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#94a3b8' }}
        >
          &times;
        </button>
        {/* Header Icon */}
        <div style={{
          width: '60px', height: '60px', background: '#ecfdf5', color: '#10b981',
          borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px auto', fontSize: '2rem'
        }}>
          <CheckCircleIcon width="32" height="32" />
        </div>

        <h2 style={{ margin: '0 0 10px', color: '#1e293b' }}>Resolution Verified?</h2>
        <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '20px' }}>
          The staff has marked your grievance regarding <strong>{grievance.category}</strong> as resolved.
          <br />Are you satisfied with the solution?
        </p>

        {/* Staff Remarks Preview */}
        {grievance.resolutionRemarks && (
          <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', fontSize: '0.9rem', color: '#334155', marginBottom: '25px', textAlign: 'left', border: '1px solid #e2e8f0' }}>
            <strong>Staff Remarks:</strong>
            <p style={{ margin: '5px 0 0', fontStyle: 'italic' }}>"{grievance.resolutionRemarks}"</p>
          </div>
        )}



        {/* Action Buttons */}
        {!showRejectInput ? (
          <div style={{ textAlign: "center" }}>

            {/* ⚠️ Warning after first rejection */}
            {isLastAttempt && (
              <p style={{
                color: "#b91c1c",
                fontSize: "0.85rem",
                marginBottom: "12px"
              }}>
                ⚠️ You have already rejected once.
                As per university policy, further rejection is not allowed.
              </p>
            )}

            <div style={{ display: "flex", gap: "15px", justifyContent: "center" }}>

              {/* ❌ Reject button ONLY on first attempt */}
              {!isLastAttempt && (
                <button
                  onClick={() => setShowRejectInput(true)}
                  style={{
                    padding: "12px 24px",
                    borderRadius: "12px",
                    border: "none",
                    background: "#fee2e2",
                    color: "#ef4444",
                    fontWeight: "600",
                    cursor: "pointer"
                  }}
                >
                  No, I'm not
                </button>
              )}

              {/* ✅ Accept always allowed */}
              <button
                type="button"
                onClick={() => onVerify(grievance._id, "accept", "")}
                disabled={grievance.status !== "Verification"}
                style={{
                  padding: "12px 24px",
                  borderRadius: "12px",
                  border: "none",
                  background: "#10b981",
                  color: "white",
                  fontWeight: "600",
                  cursor: "pointer"
                }}

              >
                Yes, Close It
              </button>

            </div>
          </div>
        ) : (
          /* REJECTION FEEDBACK TEXTAREA */
          <div style={{ animation: "fadeIn 0.3s" }}>
            <textarea
              placeholder="Please tell us why you are not satisfied..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "12px",
                border: "1px solid #cbd5e1",
                marginBottom: "15px",
                minHeight: "80px"
              }}
              autoFocus
            />

            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                onClick={() => setShowRejectInput(false)}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  background: "white",
                  color: "#64748b",
                  fontWeight: "600",
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>

              <button
                onClick={() => onVerify(grievance._id, "reject", feedback)}
                disabled={!feedback.trim()}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#ef4444",
                  color: "white",
                  fontWeight: "600",
                  cursor: "pointer",
                  opacity: feedback.trim() ? 1 : 0.6
                }}
              >
                Reopen Grievance
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default StudentDashboard;