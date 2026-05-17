import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import "../styles/Dashboard.css";
import ctLogo from "../assets/ct-logo.png";
import { GraduationCapIcon } from "../components/Icons";

function Examination() {
  const navigate = useNavigate();
  const role = localStorage.getItem("grievance_role");
  const userId = localStorage.getItem("grievance_id");

  const categoryTitle = "Examination";

  const [formData, setFormData] = useState({
    name: "",
    regid: userId || "",
    email: "",
    phone: "",
    school: "",
    message: "",
  });

  const [attachment, setAttachment] = useState(null);
  const [msg, setMsg] = useState("");
  const [statusType, setStatusType] = useState("");
  const [loading, setLoading] = useState(true);
  const [issueTypes, setIssueTypes] = useState([]);
  const [selectedIssueType, setSelectedIssueType] = useState("");

  // Auth Check
  useEffect(() => {
    if (!role || role !== "student") navigate("/");
  }, [role, navigate]);

  // ✅ FETCH USER DATA
  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/auth/user/${userId}`);
        const data = await res.json();
        if (res.ok) {
          setFormData((prev) => ({
            ...prev,
            name: data.fullName || "",
            email: data.email || "",
            phone: data.phone || "",
            school: data.department || "",
          }));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (userId) fetchUserDetails();
  }, [userId]);

  // ✅ FETCH ISSUE TYPES FOR EXAMINATION
  useEffect(() => {
    const fetchIssueTypes = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/issue-types/department/Examination");
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
    setFormData({ ...formData, [e.target.name]: e.target.value });
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
    setMsg("Submitting...");
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
        setMsg(`Upload Error: ${err.message}`); setStatusType("error"); return;
      }
    }

    // 2️⃣ Submit Grievance as JSON
    const payload = {
      userId,
      name: formData.name,
      regid: formData.regid,
      email: formData.email,
      phone: formData.phone,
      studentProgram: formData.school || "Engineering",
      category: "Examination",
      message: formData.message,
      attachment: attachmentUrl || "",
      issueTypeId: selectedIssueType || null // ✅ Include issue type for auto-assignment
    };

    try {
      const res = await fetch("http://localhost:5000/api/grievances/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.message);

      setMsg("Grievance submitted successfully!");
      setStatusType("success");

      setFormData((prev) => ({ ...prev, issueType: "", message: "" }));
      setAttachment(null);

      const fileInput = document.getElementById("fileInput");
      if (fileInput) fileInput.value = "";
    } catch (err) {
      setMsg(`${err.message}`);
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
              {formData.school && <span className="status-badge status-assigned" style={{ marginLeft: '10px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <GraduationCapIcon width="14" height="14" /> {formData.school}
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
          <li><Link to="/student/welfare">Student Welfare</Link></li>
          <li><Link to="/student/admission">Admission</Link></li>
          <li><Link to="/student/section">Student Section</Link></li>
          <li><Link to="/student/accounts">Accounts</Link></li>
          <li className="active"><Link to="/student/examination">Examination</Link></li>
          <li><Link to="/student/department">Department</Link></li>
          <li><Link to="/student/hr">HR</Link></li>
          <li><Link to="/student/crc">CRC (Placement)</Link></li>
        </ul>
      </nav>

      <main className="dashboard-body">
        <div className="card">
          <h2>Submit {categoryTitle} Grievance</h2>

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

              {/* ✅ School / Department Field (Auto-Filled) */}
              <div className="input-group">
                <label>School / Department</label>
                <input
                  type="text"
                  name="school"
                  value={formData.school}
                  readOnly
                  className="read-only-input"
                />
              </div>

              <div className="input-group">
                <label>Select Issue</label>
                <select
                  value={selectedIssueType}
                  onChange={(e) => setSelectedIssueType(e.target.value)}
                  required
                  style={{ padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", cursor: "pointer" }}
                >
                  <option value="">-- Choose an Issue --</option>
                  {issueTypes.map((issue) => (
                    <option key={issue._id} value={issue._id}>
                      {issue.issueName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label>Message</label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  rows="4"
                  placeholder="Describe your issue..."
                  required
                ></textarea>
              </div>

              <div className="input-group">
                <label>Attach Admit Card/Result (Optional)</label>
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

export default Examination;