import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Dashboard.css";
import IssueManagementPanel from "../components/IssueManagementPanel";
import RoutingRuleConfig from "../components/RoutingRuleConfig";
import ctLogo from "../assets/ct-logo.png";
import { ShieldIcon } from "../components/Icons";

function IssueManagementPage() {
  const navigate = useNavigate();
  const role = localStorage.getItem("grievance_role")?.toLowerCase();
  const adminDept = localStorage.getItem("admin_department");
  const isDeptAdmin = localStorage.getItem("is_dept_admin") === "true";
  const isMasterAdmin = localStorage.getItem("is_master_admin") === "true";

  const [activeTab, setActiveTab] = useState("issues");

  useEffect(() => {
    // Only Department Admins and Master Admin can access
    if (!isDeptAdmin && !isMasterAdmin) {
      navigate("/");
    }
  }, [isDeptAdmin, isMasterAdmin, navigate]);

  const handleLogout = () => {
    localStorage.clear();
    navigate("/");
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <img src={ctLogo} alt="CT University" style={{ height: "50px" }} />
          <div className="header-content">
            <h1>Smart Assignment Configuration</h1>
            <p>
              Department: <strong>{adminDept || "All Departments"}</strong>
              <span className="status-badge status-resolved" style={{ marginLeft: '10px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <ShieldIcon width="14" height="14" /> {isMasterAdmin ? "Master Admin" : "Department Admin"}
              </span>
            </p>
          </div>
        </div>
        <button className="logout-btn-header" onClick={handleLogout}>
          Logout
        </button>
      </header>

      <nav className="navbar">
        <ul>
          <li className={activeTab === "issues" ? "active" : ""}>
            <button onClick={() => setActiveTab("issues")} className="tab-link-button">
              Issue Types
            </button>
          </li>
          <li className={activeTab === "routing" ? "active" : ""}>
            <button onClick={() => setActiveTab("routing")} className="tab-link-button">
              Routing Rules
            </button>
          </li>
          <li style={{ marginLeft: 'auto' }}>
            <button onClick={() => navigate(-1)} className="tab-link-button">
              ⬅ Back
            </button>
          </li>
        </ul>
      </nav>

      <main className="dashboard-body">
        {activeTab === "issues" && (
          <IssueManagementPanel department={adminDept} />
        )}
        {activeTab === "routing" && (
          <RoutingRuleConfig department={adminDept} />
        )}
      </main>
    </div>
  );
}

export default IssueManagementPage;
