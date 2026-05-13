import React, { useState, useEffect } from "react";
import "../styles/Dashboard.css";
import { DownloadIcon, UsersIcon } from "./Icons";

const AdminUploadRecords = () => {
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [exportingUsers, setExportingUsers] = useState(false);
  const [message, setMessage] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");

  const token = localStorage.getItem("grievance_token");

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const res = await fetch("http://localhost:5000/api/admin/all-users", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else {
        setMessage("❌ Failed to fetch users");
      }
    } catch (err) {
      console.error("Error fetching users:", err);
      setMessage("❌ Server Error. Could not fetch users.");
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleExportUsers = async () => {
    setExportingUsers(true);
    try {
      const res = await fetch("http://localhost:5000/api/admin/export-users", {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `users_export_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setMessage("✅ Users exported successfully!");
      } else {
        setMessage("❌ Failed to export users");
      }
    } catch (err) {
      console.error("Export Error:", err);
      setMessage("❌ Export failed");
    } finally {
      setExportingUsers(false);
    }
  };

  const filteredUsers = users.filter(user => {
    if (roleFilter === "All") return true;
    if (roleFilter === "Student" && user.role === "student") return true;
    if (roleFilter === "Staff" && user.role === "staff" && !user.isMasterAdmin) return true;
    if (roleFilter === "Admin" && user.role === "admin" && !user.isMasterAdmin) return true;
    if (roleFilter === "Master Admin" && user.isMasterAdmin) return true;
    return false;
  });

  return (
    <div className="upload-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ marginBottom: '10px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <UsersIcon width="28" height="28" />
            Users Database
          </h2>
          <p style={{ color: '#64748b', margin: 0 }}>View all registered users and export them to Excel.</p>
        </div>
        <button
          onClick={handleExportUsers}
          disabled={exportingUsers}
          className="action-btn"
          style={{
            background: '#10b981',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            opacity: exportingUsers ? 0.6 : 1,
            padding: '10px 20px',
            fontSize: '1rem',
            border: 'none',
            borderRadius: '6px',
            cursor: exportingUsers ? 'not-allowed' : 'pointer',
            boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)'
          }}
        >
          <DownloadIcon width="20" height="20" />
          {exportingUsers ? "Exporting..." : "Export All Users"}
        </button>
      </div>

      {message && (
        <div
          style={{
            marginBottom: '20px',
            padding: '12px',
            borderRadius: '8px',
            color: message.startsWith("❌") ? "#dc2626" : "#16a34a",
            backgroundColor: message.startsWith("❌") ? "#fef2f2" : "#f0fdf4",
            border: `1px solid ${message.startsWith("❌") ? "#fecaca" : "#bbf7d0"}`
          }}
        >
          {message}
        </div>
      )}

      <div style={{ marginBottom: '20px', display: 'flex', gap: '15px', alignItems: 'center' }}>
        <span style={{ fontWeight: '500', color: '#475569' }}>Filter by Role:</span>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            outline: 'none',
            fontSize: '0.95rem',
            color: '#334155',
            backgroundColor: 'white',
            cursor: 'pointer'
          }}
        >
          <option value="All">All Users</option>
          <option value="Student">Student</option>
          <option value="Staff">Staff</option>
          <option value="Admin">Admin</option>
          <option value="Master Admin">Master Admin</option>
        </select>
        
        <span style={{ color: '#64748b', fontSize: '0.9rem', marginLeft: 'auto' }}>
          Showing {filteredUsers.length} of {users.length} users
        </span>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loadingUsers ? (
          <p style={{ color: '#64748b', padding: '40px', textAlign: 'center' }}>Loading users database...</p>
        ) : users.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
            <UsersIcon width="48" height="48" style={{ margin: '0 auto 15px', opacity: 0.3, display: 'block' }} />
            <p>No users found in the database.</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
            <UsersIcon width="48" height="48" style={{ margin: '0 auto 15px', opacity: 0.3, display: 'block' }} />
            <p>No users match the "{roleFilter}" filter.</p>
          </div>
        ) : (
          <div className="table-container" style={{ maxHeight: 'calc(100vh - 250px)', overflowY: 'auto', margin: 0 }}>
            <table className="grievance-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', margin: 0 }}>
              <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <tr>
                  <th style={{ padding: '15px 20px', fontWeight: '600', color: '#475569', borderBottom: '2px solid #e2e8f0' }}>Reg No. / ID</th>
                  <th style={{ padding: '15px 20px', fontWeight: '600', color: '#475569', borderBottom: '2px solid #e2e8f0' }}>Name</th>
                  <th style={{ padding: '15px 20px', fontWeight: '600', color: '#475569', borderBottom: '2px solid #e2e8f0' }}>Department</th>
                  <th style={{ padding: '15px 20px', fontWeight: '600', color: '#475569', borderBottom: '2px solid #e2e8f0' }}>Email</th>
                  <th style={{ padding: '15px 20px', fontWeight: '600', color: '#475569', borderBottom: '2px solid #e2e8f0' }}>Phone No.</th>
                  <th style={{ padding: '15px 20px', fontWeight: '600', color: '#475569', borderBottom: '2px solid #e2e8f0' }}>Role</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #e2e8f0', transition: 'background-color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <td style={{ padding: '15px 20px', fontWeight: '600', color: '#1e293b' }}>{user.id}</td>
                    <td style={{ padding: '15px 20px', color: '#334155' }}>{user.fullName || 'N/A'}</td>
                    <td style={{ padding: '15px 20px', color: '#334155' }}>{user.department || user.adminDepartment || user.program || 'N/A'}</td>
                    <td style={{ padding: '15px 20px', color: '#334155' }}>{user.email || 'N/A'}</td>
                    <td style={{ padding: '15px 20px', color: '#334155' }}>{user.phone || 'N/A'}</td>
                    <td style={{ padding: '15px 20px' }}>
                      <span style={{
                        padding: '6px 10px',
                        borderRadius: '20px',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        backgroundColor: user.isMasterAdmin ? '#fef3c7' : user.role === 'admin' ? '#dbeafe' : user.role === 'staff' ? '#f3e8ff' : '#e0f2fe',
                        color: user.isMasterAdmin ? '#b45309' : user.role === 'admin' ? '#1d4ed8' : user.role === 'staff' ? '#7e22ce' : '#0369a1',
                        border: `1px solid ${user.isMasterAdmin ? '#fde68a' : user.role === 'admin' ? '#bfdbfe' : user.role === 'staff' ? '#e9d5ff' : '#bae6fd'}`
                      }}>
                        {user.isMasterAdmin ? 'Master Admin' : user.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUploadRecords;