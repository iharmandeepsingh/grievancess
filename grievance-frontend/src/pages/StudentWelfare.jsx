import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import "../styles/Dashboard.css";
import ctLogo from "../assets/ct-logo.png";
import { GraduationCapIcon } from "../components/Icons";

function StudentWelfare() {
  const navigate = useNavigate();
  const role = localStorage.getItem("grievance_role");
  const userId = localStorage.getItem("grievance_id"); // 8-digit

  const [formData, setFormData] = useState({
    name: "",
    regid: userId || "",
    email: "",
    phone: "",
    program: "", // 🔥 STUDENT COURSE
    message: "",
  });

  const [attachment, setAttachment] = useState(null);
  const [msg, setMsg] = useState("");
  const [statusType, setStatusType] = useState("");
  const [loading, setLoading] = useState(true);

  // ✅ NEW: Issue Type Selection
  const [issueTypes, setIssueTypes] = useState([]);
  const [selectedIssueType, setSelectedIssueType] = useState("");

  // 🔒 Route protection
  useEffect(() => {
    if (!role || role !== "student") navigate("/");
  }, [role, navigate]);

  // ✅ Fetch student profile
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(
          `http://localhost:5000/api/auth/user/${userId}`
        );
        const data = await res.json();

        if (res.ok) {
          setFormData((prev) => ({
            ...prev,
            name: data.fullName || "",
            email: data.email || "",
            phone: data.phone || "",
            program: data.department || data.program || "", // 🔥 IMPORTANT
          }));
        }
      } catch (err) {
        console.error("User fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    if (userId) fetchUser();
  }, [userId]);

  // ✅ NEW: Fetch issue types for Student Welfare
  useEffect(() => {
    const fetchIssueTypes = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/issue-types/department/Student Welfare");
        if (!res.ok) {
          const errorText = await res.text();
          console.error("Fetch issue types error:", errorText);
          return;
        }
        const data = await res.json();
        console.log("Fetched issue types:", data);
        setIssueTypes(data);
      } catch (error) {
        console.error("Error fetching issue types:", error);
      }
    };
    fetchIssueTypes();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, message: e.target.value });
  };

  const handleFileChange = (e) => {
    setAttachment(e.target.files[0]);
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate("/");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("Submitting grievance...");
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
        console.error("[FRONTEND] Upload Error:", err);
        setMsg(`Upload Error: ${err.message}`); setStatusType("error"); return;
      }
    }

    // 2️⃣ Submit Grievance as JSON (Fix for Backend)
    const payload = {
      userId,
      name: formData.name,
      regid: formData.regid,
      email: formData.email,
      phone: formData.phone,
      studentProgram: formData.program,
      category: "Student Welfare",
      message: formData.message,
      attachment: attachmentUrl || "", // Send filename string
      issueTypeId: selectedIssueType || null // ✅ NEW: Include issue type for auto-assignment
    };

    try {
      const res = await fetch(
        "http://localhost:5000/api/grievances/submit",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" }, // ✅ Important
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setMsg("✅ Grievance submitted successfully");
      setStatusType("success");
      setFormData((prev) => ({ ...prev, message: "" }));
      setAttachment(null);

      const fileInput = document.getElementById("fileInput");
      if (fileInput) fileInput.value = "";
    } catch (err) {
      setMsg(`❌ ${err.message}`);
      setStatusType("error");
    }
  };



  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <img src={ctLogo} alt="CT University" style={{ height: "50px" }} />
          <div className="header-content">
            <h1>Student Dashboard</h1>
            <p>
              Welcome, <strong>{formData.name || userId}</strong>
              {formData.program && <span className="status-badge status-assigned" style={{ marginLeft: '10px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <GraduationCapIcon width="14" height="14" /> {formData.program}
              </span>}
            </p>
          </div>
        </div>
        <button className="logout-btn-header" onClick={handleLogout}>
          Logout
        </button>
      </header>

      <nav className="navbar">
        <ul>
          <li><Link to="/student/dashboard">Dashboard</Link></li>
          <li className="active"><Link to="/student/welfare">Student Welfare</Link></li>
          <li><Link to="/student/admission">Admission</Link></li>
          <li><Link to="/student/section">Student Section</Link></li>
          <li><Link to="/student/accounts">Accounts</Link></li>
          <li><Link to="/student/examination">Examination</Link></li>
          <li><Link to="/student/department">Department</Link></li>
          <li><Link to="/student/hr">HR</Link></li>
          <li><Link to="/student/crc">CRC (Placement)</Link></li>
        </ul>
      </nav>

      <main className="dashboard-body">
        <div className="card">
          <h2>Submit Student Welfare Grievance</h2>

          {loading ? (
            <p>Loading your details...</p>
          ) : (
            <form onSubmit={handleSubmit}>
              {msg && <div className={`alert-box ${statusType}`}>{msg}</div>}

              <div className="form-row">
                <div className="input-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    readOnly
                    className="read-only-input"
                  />
                </div>
                <div className="input-group">
                  <label>Registration ID</label>
                  <input
                    type="text"
                    name="regid"
                    value={formData.regid}
                    readOnly
                    className="read-only-input"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="input-group">
                  <label>Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    readOnly
                    className="read-only-input"
                  />
                </div>
                <div className="input-group">
                  <label>Phone</label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    readOnly
                    className="read-only-input"
                  />
                </div>
              </div>

              <div className="input-group">
                <label>Program / Course</label>
                <input
                  type="text"
                  name="program"
                  value={formData.program}
                  readOnly
                  className="read-only-input"
                />
              </div>

              {/* ✅ NEW: Issue Type Dropdown */}
              {issueTypes.length > 0 && (
                <div className="input-group">
                  <label>Issue Type</label>
                  <select
                    value={selectedIssueType}
                    onChange={(e) => setSelectedIssueType(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      fontSize: "1rem"
                    }}
                  >
                    <option value="">Select an issue type (optional)</option>
                    {issueTypes.map((issue) => (
                      <option key={issue._id} value={issue._id}>
                        {issue.issueName}
                      </option>
                    ))}
                  </select>
                  {selectedIssueType && (
                    <p style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "5px" }}>
                      🤖 This grievance will be auto-assigned based on routing rules
                    </p>
                  )}
                </div>
              )}

              <div className="input-group">
                <label>Message</label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  rows="4"
                  placeholder="Details..."
                  required
                />
              </div>

              <div className="input-group">
                <label>Attach Document (Optional)</label>
                <input
                  id="fileInput"
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="file-input"
                />
              </div>

              <button type="submit" className="submit-btn">
                Submit Grievance
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

export default StudentWelfare;
