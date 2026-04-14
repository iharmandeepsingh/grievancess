import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Dashboard.css";
// IMPORT CHAT COMPONENT
import ChatPopup from "../components/ChatPopup";
import ExportPreviewModal from "../components/ExportPreviewModal";
import ctLogo from "../assets/ct-logo.png";
import { ShieldIcon, BellIcon, PaperclipIcon, EyeIcon, ClockIcon, XIcon, TrashIcon, DownloadIcon } from "../components/Icons";

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

// Date-only formatter for deadlines (no time)
const formatDateDateOnly = (dateString) => {
  if (!dateString) return "-";
  const options = { year: "numeric", month: "short", day: "numeric" };
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

function AdminStaffDashboard() {
  const navigate = useNavigate();

  // ✅ Get Details from LocalStorage (Faster & Error Free)
  const role = localStorage.getItem("grievance_role")?.toLowerCase();
  const staffId = localStorage.getItem("grievance_id")?.toUpperCase();
  const myDepartment = localStorage.getItem("admin_department"); // From Login Response
  const isDeptAdmin = localStorage.getItem("is_dept_admin") === "true";

  // UI State
  const [activeTab, setActiveTab] = useState("assigned"); // "assigned" | "submit" | "mine"
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [grievances, setGrievances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [statusType, setStatusType] = useState("");

  // --- CHAT STATE ---
  const [showChat, setShowChat] = useState(false);
  const [currentChatId, setCurrentChatId] = useState(null);

  // --- NOTIFICATION STATE ---
  const [unreadMap, setUnreadMap] = useState({});
  const [toast, setToast] = useState({ show: false, message: "" });
  const lastMessageRef = useRef({});
  const isFirstPoll = useRef(true);

  // ✅ State for "See More" Details Popup
  const [selectedGrievance, setSelectedGrievance] = useState(null);

  // --- SUBMISSION STATE ---
  const [formData, setFormData] = useState({
    department: "",
    message: "",
  });
  const [attachment, setAttachment] = useState(null);
  const [errors, setErrors] = useState({});
  const [myGrievances, setMyGrievances] = useState([]);
  const [loadingMine, setLoadingMine] = useState(false);

  // ✅ FILTER STATES
  const [searchId, setSearchId] = useState(""); // Acts as Student ID or Staff ID based on tab
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterDepartment, setFilterDepartment] = useState("All");
  const [filterMonth, setFilterMonth] = useState("");

  // EXTENSION REQUEST STATES
  const [extensionPopup, setExtensionPopup] = useState(null); // { grievance }
  const [extDate, setExtDate] = useState("");
  const [extReason, setExtReason] = useState("");

  // EXPORT MODAL STATE
  const [showExportModal, setShowExportModal] = useState(false);


  // 1. Authorization Check
  useEffect(() => {
    // Must be Staff
    if (!role || role !== "staff") {
      navigate("/");
      return;
    }

    // Must belong to a department (Rajesh has dept, General Staff does not)
    if (!myDepartment) {
      // Redirect General Staff back to General Dashboard
      navigate("/staff/general");
      return;
    }

    // Optional: If Boss tries to access Worker View, redirect them to Boss View?
    // For now, we allow Boss to see this view if they really want, but usually App.js handles it.

  }, [role, myDepartment, navigate]);

  // 2. Fetch User Name
  useEffect(() => {
    const fetchStaffInfo = async () => {
      try {
        const userRes = await fetch(`http://localhost:5000/api/auth/user/${staffId}`);
        const userData = await userRes.json();
        if (userRes.ok) {
          setStaffName(userData.fullName || staffId);
          setStaffEmail(userData.email || "");
        }
      } catch (err) {
        console.error("Error fetching staff info:", err);
      }
    };
    if (staffId) fetchStaffInfo();
  }, [staffId]);

  // 3. Fetch Assigned Grievances (optimized to avoid flicker)
  // Track last user scroll time and keep a ref for current grievances to do cheap change detection
  const lastUserScrollRef = useRef(0);
  const grievancesRef = useRef(grievances);
  const isFetchingRef = useRef(false);
  useEffect(() => { grievancesRef.current = grievances; }, [grievances]);

  useEffect(() => {
    const onScroll = () => { lastUserScrollRef.current = Date.now(); };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!staffId) return;

    let canceled = false;
    let timerId = null;
    const POLL_DELAY = 30000; // 30s

    const pollOnce = async () => {
      if (canceled) return;

      // Avoid overlapping polls
      if (isFetchingRef.current) {
        timerId = setTimeout(pollOnce, 1000);
        return;
      }

      // Set loading to true to show skeleton only for the very first attempts
      setLoading(true);

      // Skip if tab is hidden
      if (document.hidden) {
        setLoading(false);
        timerId = setTimeout(pollOnce, POLL_DELAY);
        return;
      }

      // Skip while user is interacting
      if (selectedGrievance) { setLoading(false); timerId = setTimeout(pollOnce, POLL_DELAY); return; }
      if (Date.now() - lastUserScrollRef.current < 2000) { setLoading(false); timerId = setTimeout(pollOnce, 2000); return; }

      isFetchingRef.current = true;
      try {
        const res = await fetch(`http://localhost:5000/api/grievances/assigned/${staffId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to fetch data");

        // Cheap change detection: compare signatures (id + updatedAt/createdAt)
        const oldSig = (grievancesRef.current || []).map(g => `${g._id}:${g.updatedAt || g.createdAt}`).join('|');
        const newSig = (data || []).map(g => `${g._id}:${g.updatedAt || g.createdAt}`).join('|');
        if (oldSig !== newSig) {
          const prevScrollY = window.scrollY || window.pageYOffset;
          setGrievances(data);
          requestAnimationFrame(() => window.scrollTo(0, prevScrollY));
          if (data.length === 0) { setMsg("No grievances currently assigned to you."); setStatusType("info"); }
        }
      } catch (err) {
        console.error(new Date().toISOString(), "Error polling assigned grievances:", err);
        setMsg("Failed to load your assigned grievances.");
        setStatusType("error");
      } finally {
        isFetchingRef.current = false;
        setLoading(false);
        if (!canceled) timerId = setTimeout(pollOnce, POLL_DELAY);
      }
    };

    // Start polling loop
    pollOnce();

    return () => { canceled = true; if (timerId) clearTimeout(timerId); };
  }, [staffId, selectedGrievance]);

  // --- 4. LIVE POLLING FOR NOTIFICATIONS ONLY ---
  useEffect(() => {
    if (!staffId || grievances.length === 0) return;

    const pollMessages = async () => {
      const newUnreadMap = { ...unreadMap };
      let newToastMsg = null;

      await Promise.all(grievances.map(async (g) => {
        try {
          const res = await fetch(`http://localhost:5000/api/chat/${g._id}`);
          if (res.ok) {
            const msgs = await res.json();

            if (msgs.length > 0) {
              const lastMsg = msgs[msgs.length - 1];

              // If sender is NOT staff, then it's student -> UNREAD
              const isStudentSender = (lastMsg.senderRole !== "staff" && lastMsg.senderId !== staffId);

              // A. Red Dot Logic
              if (showChat && currentChatId === g._id) {
                newUnreadMap[g._id] = false;
              } else {
                newUnreadMap[g._id] = isStudentSender;
              }

              // B. Toast Logic
              if (lastMessageRef.current[g._id] !== lastMsg._id) {
                if (!isFirstPoll.current && isStudentSender) {
                  newToastMsg = `New message from ${g.name}`;
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
  }, [grievances, staffId, showChat, currentChatId]);

  const showToastNotification = (message) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: "" }), 3000);
  };

  // --- CHAT FUNCTIONS ---
  const openChat = (grievanceId) => {
    setCurrentChatId(grievanceId);
    setShowChat(true);
    // Remove red dot immediately
    setUnreadMap(prev => ({ ...prev, [grievanceId]: false }));
  };

  const closeChat = () => {
    setShowChat(false);
    setCurrentChatId(null);
  };

  const updateStatus = async (id, newStatus) => {
    setMsg("Updating status...");
    setStatusType("info");
    try {
      const res = await fetch(`http://localhost:5000/api/grievances/update/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          resolvedBy: staffId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Update failed");

      setMsg("Status updated successfully!");
      setStatusType("success");

      setGrievances((prev) =>
        prev.map((g) => (g._id === id ? data.grievance : g))
      );
    } catch (err) {
      console.error("Error updating grievance:", err);
      setMsg(`Error: ${err.message}`);
      setStatusType("error");
    }
  };

  const handleExtensionRequest = async () => {
    if (!extDate || !extReason) return alert("Please fill all fields");
    try {
      const res = await fetch(`http://localhost:5000/api/grievances/extension/request/${extensionPopup._id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestedDate: extDate, reason: extReason })
      });
      const data = await res.json();
      if (res.ok) {
        alert("Extension Requested!");
        setExtensionPopup(null);
        setExtDate("");
        setExtReason("");
        // Assuming fetchMyTasks() is a function to refresh the assigned grievances list
        // If not, you might need to call the polling function or manually update state
        // For now, let's assume a refresh function exists or trigger a re-fetch.
        // A simple way to trigger re-fetch is to clear grievances and let useEffect re-run.
        // Optimistic update: Update the specific grievance in the local state
        setGrievances(prev => prev.map(g => {
          if (g._id === extensionPopup._id) {
            return {
              ...g,
              extensionRequest: { ...g.extensionRequest, status: "Pending", requestedDate: extDate, reason: extReason }
            };
          }
          return g;
        }));
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert("Failed to request extension");
    }
  };

  // --- SUBMISSION HANDLERS ---
  const handleFileChange = (e) => {
    setAttachment(e.target.files[0]);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.department || !formData.message) {
      setMsg("Please fill all required fields.");
      setStatusType("error");
      return;
    }

    setMsg("Submitting your grievance...");
    setStatusType("info");

    // 1️⃣ Upload File
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
          userId: staffId,
          name: staffName,
          email: staffEmail,
          phone: "",
          regid: staffId,
          school: formData.department, // Selected School
          category: formData.department, // Routes to School Admin
          message: formData.message,
          studentProgram: "Admin Staff", // Required by backend
          attachment: attachmentUrl || ""
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Submission failed");

      setMsg("Grievance submitted successfully!");
      setStatusType("success");
      setFormData({ department: "", message: "" });
      setAttachment(null);
      if (document.getElementById("adminStaffFile")) document.getElementById("adminStaffFile").value = "";

      fetchMySubmissions(); // Refresh list
    } catch (err) {
      setMsg(`Error: ${err.message}`);
      setStatusType("error");
    }
  };

  const fetchMySubmissions = async () => {
    if (!staffId) return;
    setLoadingMine(true);
    try {
      const res = await fetch(`http://localhost:5000/api/grievances/user/${staffId}`);
      const data = await res.json();
      if (res.ok) setMyGrievances(data);
    } catch (err) {
      console.error("Error fetching my submissions:", err);
    } finally {
      setLoadingMine(false);
    }
  };

  // Load my submissions when tab changes
  useEffect(() => { if (activeTab === "mine") fetchMySubmissions(); }, [activeTab]);

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

  // ✅ FILTER LOGIC
  const getFilteredData = (data, type) => {
    return data.filter((g) => {
      // 1. Search ID (Student ID for Assigned, Staff ID for Mine)
      let matchId = true;
      if (searchId) {
        const q = searchId.toLowerCase();
        if (type === "assigned") {
          matchId = (g.userId || "").toLowerCase().includes(q) || (g.name || "").toLowerCase().includes(q);
        } else {
          matchId = (g.assignedTo || "").toLowerCase().includes(q);
        }
      }

      // 2. Common Filters
      const matchStatus = filterStatus === "All" || g.status === filterStatus;
      const matchDept = filterDepartment === "All" || (g.category || g.school || "") === filterDepartment;

      let matchMonth = true;
      if (filterMonth) {
        const gDate = new Date(g.createdAt);
        const [year, month] = filterMonth.split("-");
        matchMonth = gDate.getFullYear() === parseInt(year) && (gDate.getMonth() + 1) === parseInt(month);
      }

      return matchId && matchStatus && matchDept && matchMonth;
    });
  };

  // Get Unique Departments for Dropdown
  const currentList = activeTab === "assigned" ? grievances : myGrievances;
  const uniqueDepartments = [...new Set(currentList.map(g => g.category || g.school).filter(Boolean))];

  const handleOpenExportModal = () => setShowExportModal(true);
  const handleExportSelected = (selectedData, selectedColumns) => {
    const token = localStorage.getItem("grievance_token");
    fetch(`http://localhost:5000/api/grievances/export-selected`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ grievanceIds: selectedData.map((g) => g._id), columns: selectedColumns }),
    }).then((res) => { if (!res.ok) throw new Error(); return res.blob(); })
      .then((blob) => {
        const url = window.URL.createObjectURL(blob); const a = document.createElement("a");
        a.href = url; a.download = `staff_grievances_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a); a.click(); a.remove();
        setMsg("Export successful!"); setStatusType("success"); setTimeout(() => setMsg(""), 3000);
      }).catch(() => alert("Excel export failed"));
  };

  return (
    <div className="dashboard-container">
      {/* Toast Notification */}
      {toast.show && (
        <div className="toast-notification">
          <span><BellIcon width="20" height="20" /></span>
          {toast.message}
        </div>
      )}

      <header className="dashboard-header">
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <img src={ctLogo} alt="CT University" style={{ height: "50px" }} />
          <div className="header-content">
            <h1>Admin Staff Dashboard</h1>
            <p>
              Welcome, {staffName || staffId}
              {/* ✅ Badge for Team Member */}
              <span className="status-badge status-assigned" style={{ marginLeft: '10px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <ShieldIcon width="14" height="14" /> Team: {myDepartment}
              </span>
            </p>
          </div>
        </div>
        <button className="logout-btn-header" onClick={handleLogout}>
          Logout
        </button>
      </header>

      {/* ✅ TABS NAVBAR (Pill Style) */}
      <nav className="navbar">
        <ul>
          <li className={activeTab === "assigned" ? "active" : ""}>
            <button onClick={() => setActiveTab("assigned")} className="tab-link-button">
              My Assigned Tasks
            </button>
          </li>
          <li className={activeTab === "submit" ? "active" : ""}>
            <button onClick={() => setActiveTab("submit")} className="tab-link-button">
              Submit Grievance
            </button>
          </li>
          <li className={activeTab === "mine" ? "active" : ""}>
            <button onClick={() => setActiveTab("mine")} className="tab-link-button">
              My Submissions
            </button>
          </li>
        </ul>
      </nav>

      <main className="dashboard-body">
        <div className="card">
          {msg && <div className={`alert-box ${statusType}`}>{msg}</div>}

          {/* TAB 1: ASSIGNED TASKS */}
          {activeTab === "assigned" && (
            <>
              <h2>Assigned Grievances</h2>
              <p style={{ marginBottom: "1rem", color: "#64748b" }}>These grievances have been specifically assigned to you.</p>

              {/* ✅ FILTER BAR */}
              <div className="filter-bar" style={{
                display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "20px",
                padding: "15px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0"
              }}>
                <input
                  type="text" placeholder="Search Student ID..."
                  value={searchId} onChange={(e) => setSearchId(e.target.value)}
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
                    setSearchId(""); setFilterStatus("All"); setFilterDepartment("All"); setFilterMonth("");
                  }}
                  style={{ padding: "10px 20px", borderRadius: "6px", border: "none", background: "#64748b", color: "white", cursor: "pointer", fontWeight: "600" }}
                >
                  Reset
                </button>
                <button onClick={handleOpenExportModal} style={{ padding: "10px 20px", borderRadius: "6px", border: "none", background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)", color: "white", cursor: "pointer", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px", boxShadow: "0 4px 6px rgba(22, 163, 74, 0.2)" }} onMouseOver={(e) => e.currentTarget.style.transform = "translateY(-2px)"} onMouseOut={(e) => e.currentTarget.style.transform = "translateY(0)"}><DownloadIcon width="16" height="16" /> Export</button>
              </div>

              {loading ? (
                <div className="table-container">
                  <table className="grievance-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>ID</th>
                        <th>Message</th>
                        <th>Submitted At</th>
                        <th className="deadline-col">Deadline</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[1, 2, 3, 4].map(i => (
                        <tr key={i} className="skeleton-row">
                          <td><div className="skeleton skeleton-text" style={{ width: 80 }} /></td>
                          <td><div className="skeleton skeleton-text" style={{ width: 120 }} /></td>
                          <td><div className="skeleton skeleton-text" style={{ width: 80 }} /></td>
                          <td className="message-cell"><div className="skeleton skeleton-text" style={{ width: 180 }} /></td>
                          <td><div className="skeleton skeleton-text" style={{ width: 90 }} /></td>
                          <td className="deadline-col"><div className="skeleton skeleton-text" style={{ width: 90 }} /></td>
                          <td><div className="skeleton skeleton-pill" /></td>
                          <td><div className="skeleton skeleton-btn" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : getFilteredData(grievances, "assigned").length === 0 ? (
                <div className="empty-state">
                  <p>{grievances.length === 0 ? "No grievances found assigned to your ID." : "No grievances match your filters."}</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="grievance-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>ID</th>
                        <th>Message</th>
                        <th>Submitted At</th>                    <th className="deadline-col">Deadline</th>                    <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getFilteredData(grievances, "assigned").map((g) => (
                        <tr key={g._id} onClick={() => setSelectedGrievance(g)} style={{ cursor: "pointer" }}>
                          <td>{g.name}</td>
                          <td>{g.email}</td>
                          <td>{g.regid || "-"}</td>

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

                          <td>{formatDate(g.createdAt)}</td>
                          <td className="deadline-col">
                            {(g.deadlineDate || g.deadline || g.deadline_date) ? formatDateDateOnly(g.deadlineDate || g.deadline || g.deadline_date) : "-"}
                            {/* Extension Request Button */}
                            {g.status !== "Resolved" && g.status !== "Rejected" && (
                              <div style={{ marginTop: "5px" }}>
                                {g.extensionRequest?.status === "Pending" ? (
                                  <span style={{ fontSize: "0.75rem", color: "#d97706", fontWeight: "600" }}>Ext. Pending</span>
                                ) : (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setExtensionPopup(g); }}
                                    title="Request Deadline Extension"
                                    style={{ background: "none", border: "none", cursor: "pointer", color: "#6366f1", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.8rem" }}
                                  >
                                    <ClockIcon width="14" height="14" /> Extend
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                          <td>
                            <span
                              className={`status-badge status-${g.status
                                .toLowerCase()
                                .replace(" ", "")}`}
                            >
                              {g.status}
                            </span>
                          </td>
                          <td className="action-cell">
                            <div className="action-buttons">
                              {g.status !== "Resolved" && g.status !== "Rejected" ? (
                                <>
                                  <button
                                    className="action-btn resolve-btn"
                                    onClick={(e) => { e.stopPropagation(); updateStatus(g._id, "Resolved"); }}
                                  >
                                    Mark Resolved
                                  </button>
                                  <button
                                    className="action-btn reject-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (window.confirm("Are you sure you want to REJECT this grievance?")) updateStatus(g._id, "Rejected");
                                    }}
                                  >
                                    Reject
                                  </button>
                                </>
                              ) : (
                                <span className="done-btn">Resolved</span>
                              )}

                              {/* Chat Button with Notification Wrapper */}
                              <div className="chat-btn-wrapper">
                                <button
                                  className="action-btn"
                                  style={{ backgroundColor: "#2563eb", color: "white" }}
                                  onClick={(e) => { e.stopPropagation(); openChat(g._id); }}
                                >
                                  Chat
                                </button>
                                {/* 🔴 RED DOT */}
                                {unreadMap[g._id] && (
                                  <span className="notification-dot"></span>
                                )}
                              </div>

                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* TAB 2: SUBMIT GRIEVANCE */}
          {activeTab === "submit" && (
            <>
              <h2>Submit Staff Grievance</h2>
              <p>Select the relevant School/Department. It will be routed to the Head of Department.</p>

              <form onSubmit={handleSubmit}>
                <div className="form-row">
                  <div className="input-group">
                    <label>Full Name</label>
                    <input type="text" value={staffName} readOnly className="read-only-input" />
                  </div>
                  <div className="input-group">
                    <label>Staff ID</label>
                    <input type="text" value={staffId} readOnly className="read-only-input" />
                  </div>
                </div>

                <div className="input-group">
                  <label>Email</label>
                  <input type="email" value={staffEmail} readOnly className="read-only-input" />
                </div>

                <div className="input-group">
                  <label>Select School / Department</label>
                  <select name="department" value={formData.department} onChange={handleChange} required>
                    <option value="">-- Select School --</option>
                    {schools.map((school) => <option key={school} value={school}>{school}</option>)}
                  </select>
                </div>

                <div className="input-group">
                  <label>Message</label>
                  <textarea name="message" value={formData.message} onChange={handleChange} placeholder="Describe your issue..." rows="5" required></textarea>
                </div>

                <div className="input-group">
                  <label>Attach Document (Optional)</label>
                  <input id="adminStaffFile" type="file" onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png" className="file-input" />
                </div>

                <button type="submit" className="submit-btn">Submit Grievance</button>
              </form>
            </>
          )}

          {/* TAB 3: MY SUBMISSIONS */}
          {activeTab === "mine" && (
            <>
              <h2>My Submitted Grievances</h2>

              {/* ✅ FILTER BAR (For My Submissions) */}
              <div className="filter-bar" style={{
                display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "20px",
                padding: "15px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0"
              }}>
                <input
                  type="text" placeholder="Search Assigned Staff ID..."
                  value={searchId} onChange={(e) => setSearchId(e.target.value)}
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
                    setSearchId(""); setFilterStatus("All"); setFilterDepartment("All"); setFilterMonth("");
                  }}
                  style={{ padding: "10px 20px", borderRadius: "6px", border: "none", background: "#64748b", color: "white", cursor: "pointer", fontWeight: "600" }}
                >
                  Reset
                </button>
              </div>

              {loadingMine ? <p>Loading...</p> : getFilteredData(myGrievances, "mine").length === 0 ? <p>No submissions match your filters.</p> : (
                <div className="table-container">
                  <table className="grievance-table">
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>Message</th>
                        <th>Status</th>
                        <th>Assigned To</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getFilteredData(myGrievances, "mine").map((g) => (
                        <tr key={g._id} onClick={() => setSelectedGrievance(g)} style={{ cursor: "pointer" }}>
                          <td>{g.category}</td>
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
                  background: 'white',
                  padding: '20px',
                  borderRadius: '12px',
                  width: '90%',
                  maxWidth: '500px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                  position: 'relative'
                }}
              >
                {/* Modal Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '15px' }}>
                  <h3 style={{ margin: 0 }}>Grievance Details</h3>
                  <button
                    onClick={() => setSelectedGrievance(null)}
                    style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}
                  >
                    &times;
                  </button>
                </div>

                {/* Modal Body */}
                <div style={{ overflowY: 'auto', paddingRight: '5px' }}>
                  <p style={{ marginBottom: '10px', color: '#475569' }}><strong>Grievance ID:</strong> {selectedGrievance._id}</p>
                  <p style={{ marginBottom: '10px', color: '#475569' }}><strong>Student:</strong> {selectedGrievance.name || 'N/A'} <span style={{ color: '#94a3b8' }}>({selectedGrievance.userId || selectedGrievance.regid || 'N/A'})</span></p>
                  <p style={{ marginBottom: '10px', color: '#475569' }}><strong>Category:</strong> {selectedGrievance.category || selectedGrievance.school || "N/A"}</p>
                  <p style={{ marginBottom: '10px', color: '#475569' }}><strong>Date:</strong> {formatDate(selectedGrievance.createdAt)}</p>
                  <p style={{ marginBottom: '10px', color: '#475569' }}><strong>Status:</strong> <span className={`status-badge status-${selectedGrievance.status.toLowerCase()}`}>{selectedGrievance.status}</span></p>
                  <p style={{ marginBottom: '10px', color: '#475569' }}><strong>Deadline:</strong> {(selectedGrievance.deadlineDate || selectedGrievance.deadline || selectedGrievance.deadline_date) ? formatDateDateOnly(selectedGrievance.deadlineDate || selectedGrievance.deadline || selectedGrievance.deadline_date) : "-"}</p>

                  <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', margin: '15px 0', border: '1px solid #e2e8f0' }}>
                    <strong style={{ display: 'block', marginBottom: '5px', color: '#1e293b' }}>Full Message:</strong>

                    {/* --- FIXED: Break-all added here --- */}
                    <p style={{
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      lineHeight: '1.5',
                      wordBreak: 'break-all',
                      overflowWrap: 'anywhere'
                    }}>
                      {selectedGrievance.message}
                    </p>
                    {/* ----------------------------------- */}

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

                  <p style={{ marginBottom: '8px' }}><strong>Status:</strong> {selectedGrievance.status}</p>
                </div>

                {/* Modal Footer */}
                <div style={{ textAlign: 'right', marginTop: '15px' }}>
                  <button
                    onClick={() => setSelectedGrievance(null)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#e2e8f0',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      color: '#475569'
                    }}
                  >
                    Close
                  </button>
                  <button
                    onClick={() => handleDeleteGrievance(selectedGrievance._id)}
                    style={{
                      padding: '8px 16px', backgroundColor: '#fee2e2', border: '1px solid #ef4444', borderRadius: '6px',
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
          {/* --------------------------------------- */}
        </div>
      </main>

      {/* ✅ Chat Popup (Using Reusable Component) */}
      <ChatPopup
        isOpen={showChat}
        onClose={closeChat}
        grievanceId={currentChatId}
        currentUserId={staffId}
        currentUserRole="staff"
      />

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
      {/* --- EXTENSION REQUEST MODAL --- */}
      {extensionPopup && (
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
          background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000
        }}>
          <div style={{ background: "white", padding: "20px", borderRadius: "8px", width: "400px", position: "relative" }}>
            <button onClick={() => setExtensionPopup(null)} style={{ position: "absolute", top: "10px", right: "10px", background: "none", border: "none", cursor: "pointer" }}>
              <XIcon />
            </button>
            <h3 style={{ marginBottom: "15px" }}>Request Deadline Extension</h3>
            <p style={{ fontSize: "0.9rem", color: "#64748b", marginBottom: "10px" }}>Current Deadline: {formatDateDateOnly(extensionPopup.deadlineDate)}</p>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>New Proposed Date</label>
              <input
                type="date"
                value={extDate}
                onChange={(e) => setExtDate(e.target.value)}
                min={(() => {
                  const baseDateStr = extensionPopup.deadlineDate || extensionPopup.deadline || extensionPopup.deadline_date;
                  const baseDate = baseDateStr ? new Date(baseDateStr) : new Date();
                  baseDate.setDate(baseDate.getDate() + 1); // Move to next day
                  return baseDate.toISOString().split('T')[0];
                })()}
                style={{ width: "95%", padding: "8px", border: "1px solid #cbd5e1", borderRadius: "4px" }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>Reason</label>
              <textarea
                value={extReason}
                onChange={(e) => setExtReason(e.target.value)}
                placeholder="Why do you need more time?"
                style={{ width: "95%", padding: "8px", border: "1px solid #cbd5e1", borderRadius: "4px", minHeight: "80px" }}
              />
            </div>

            <button
              onClick={handleExtensionRequest}
              style={{ width: "100%", padding: "10px", background: "#6366f1", color: "white", border: "none", borderRadius: "6px", fontWeight: "600", cursor: "pointer" }}
            >
              Submit Request
            </button>
          </div>
        </div>
      )}

      {/* Export Modal */}
      <ExportPreviewModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} grievances={getFilteredData(grievances, "assigned")} staffMap={{}} onExport={handleExportSelected} />

    </div>
  );
}

export default AdminStaffDashboard;