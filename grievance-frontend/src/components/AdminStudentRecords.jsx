import React, { useState, useEffect, useRef, useCallback } from "react";
import { TrashIcon } from "./Icons";

const AdminStudentRecords = () => {
  const [records, setRecords]     = useState([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch]       = useState("");
  const [loading, setLoading]     = useState(false);
  const [clearing, setClearing]   = useState(false);
  const [dragOver, setDragOver]   = useState(false);
  const [msg, setMsg]             = useState("");
  const [msgType, setMsgType]     = useState("success");

  // ── Upload progress state ────────────────────────────────────────────────
  const [uploadState, setUploadState] = useState(null);
  const pollRef    = useRef(null);
  const startRef   = useRef(null);
  const fileInputRef = useRef();

  // Editable Row State
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({});

  // New Row State
  const [isAdding, setIsAdding] = useState(false);
  const [newRow, setNewRow] = useState({ id: "", ctuId: "", fullName: "", email: "", phone: "", school: "", program: "", batch: "", studentType: "" });

  const LIMIT = 20;
  const BASE  = "http://localhost:5000/api/student-records";
  const token = localStorage.getItem("grievance_token");

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${BASE}?page=${page}&limit=${LIMIT}&search=${encodeURIComponent(search)}`);
      const data = await res.json();
      if (res.ok) { setRecords(data.records); setTotal(data.total); setTotalPages(data.totalPages); }
      else throw new Error(data.message);
    } catch (err) { showMsg(err.message, "error"); }
    finally { setLoading(false); }
  }, [page, search, BASE]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const showMsg = (m, t = "success") => { setMsg(m); setMsgType(t); setTimeout(() => setMsg(""), 6000); };

  const stopPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };

  const startPolling = (jobId, totalRows) => {
    startRef.current = Date.now();
    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`${BASE}/progress/${jobId}`);
        const data = await res.json();
        if (!res.ok) { stopPoll(); return; }

        const elapsed = (Date.now() - startRef.current) / 1000;
        const speed   = elapsed > 0 ? Math.round(data.inserted / elapsed) : 0;
        const pct     = totalRows > 0 ? Math.round((data.processed / totalRows) * 100) : 0;
        const remaining = speed > 0 ? Math.round((totalRows - data.processed) / speed) : null;

        setUploadState({
          status:    data.status,
          jobId,
          total:     totalRows,
          processed: data.processed,
          inserted:  data.inserted,
          skipped:   data.skipped,
          pct,
          speed,
          eta:       remaining,
          errors:    data.errors || [],
        });

        if (data.status === "done" || data.status === "error") {
          stopPoll();
          fetchRecords();
          if (data.status === "done") {
            showMsg(`✅ Upload complete! ${data.inserted} inserted, ${data.skipped} skipped.`, "success");
          } else {
            showMsg(`❌ Upload failed: ${data.errorMessage || "Unknown error"}`, "error");
          }
        }
      } catch (_) { /* ignore poll errors */ }
    }, 500);
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["xlsx", "xls"].includes(ext)) { showMsg("❌ Only .xlsx or .xls files allowed", "error"); return; }

    setUploadState({ status: "uploading", pct: 0, total: 0, processed: 0, inserted: 0, skipped: 0, speed: 0, eta: null });
    stopPoll();

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res  = await fetch(`${BASE}/upload`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setUploadState({ status: "processing", jobId: data.jobId, total: data.total, processed: 0, inserted: 0, skipped: 0, pct: 0, speed: 0, eta: null });
      startPolling(data.jobId, data.total);
    } catch (err) {
      setUploadState(null);
      showMsg(`❌ ${err.message}`, "error");
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); handleFileUpload(e.dataTransfer.files[0]); };

  const handleClearAll = async () => {
    if (!window.confirm("⚠️ Delete ALL student records permanently?")) return;
    setClearing(true);
    try {
      const res  = await fetch(`${BASE}/clear-all`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) { showMsg(`✅ ${data.message}`, "success"); setUploadState(null); setPage(1); fetchRecords(); }
      else throw new Error(data.message);
    } catch (err) { showMsg(`❌ ${err.message}`, "error"); }
    finally { setClearing(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(`Delete record ${id}?`)) return;
    try {
      const res  = await fetch(`${BASE}/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) { showMsg("✅ Deleted", "success"); fetchRecords(); }
      else throw new Error(data.message);
    } catch (err) { showMsg(`❌ ${err.message}`, "error"); }
  };

  // --- inline editing ---
  const handleEditClick = (record) => {
    setEditingId(record.id);
    setEditFormData({ ...record });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditFormData({});
  };

  const handleEditChange = (e) => {
    setEditFormData({ ...editFormData, [e.target.name]: e.target.value });
  };

  const handleSaveEdit = async (id) => {
    try {
      const res = await fetch(`${BASE}/${id}`, {
         method: "PUT",
         headers: { 
           "Content-Type": "application/json",
           Authorization: `Bearer ${token}`
         },
         body: JSON.stringify(editFormData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update");
      
      showMsg("Record updated successfully", "success");
      setEditingId(null);
      fetchRecords(); 
    } catch (err) {
      showMsg(err.message, "error");
    }
  };

  // --- Add new ---
  const handleNewRowChange = (e) => {
    setNewRow({ ...newRow, [e.target.name]: e.target.value });
  };

  const handleAddNew = async () => {
    try {
      if (!newRow.id) throw new Error("ID is required");

      const res = await fetch(BASE, {
         method: "POST",
         headers: { 
           "Content-Type": "application/json",
           Authorization: `Bearer ${token}`
         },
         body: JSON.stringify(newRow)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to add");

      showMsg("New student added successfully", "success");
      setIsAdding(false);
      setNewRow({ id: "", ctuId: "", fullName: "", email: "", phone: "", school: "", program: "", batch: "", studentType: "" });
      fetchRecords();
    } catch (err) {
      showMsg(err.message, "error");
    }
  };

  const isUploading = uploadState && (uploadState.status === "uploading" || uploadState.status === "processing");
  const tableInputStyle = { width: "100%", padding: "6px", border: "1px solid #cbd5e1", borderRadius: "4px" };

  return (
    <div className="card" style={{ padding: "20px", maxWidth: "100%", margin: "0 auto" }}>
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2>Student Records (Excel View)</h2>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          style={{ padding: "10px 20px", background: "#2563eb", color: "white", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: "600" }}
        >
          {isAdding ? "Cancel Addition" : "+ Add New Student"}
        </button>
      </div>

      {msg && <div className={`alert-box ${msgType}`}>{msg}</div>}

      <div style={{ display: "flex", alignItems: "center", marginBottom: "20px", gap: "15px", justifyContent: "space-between", flexWrap: "wrap" }}>
        <form onSubmit={(e) => { e.preventDefault(); setPage(1); fetchRecords(); }} style={{ display: "flex", flexDirection: "row", alignItems: "center", flex: 1, gap: "10px", maxWidth: "800px", margin: 0 }}>
          <input 
            type="text" 
            placeholder="Search by ID, Name, Email, Phone, School..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: "10px 15px", borderRadius: "8px", border: "1px solid #cbd5e1", flex: 1, margin: 0 }}
          />
          <button type="submit" style={{ padding: "10px 20px", background: "#6366f1", color: "white", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: "600", whiteSpace: "nowrap" }}>Search</button>
          <button type="button" onClick={() => { setSearch(""); setPage(1); fetchRecords(); }} style={{ padding: "10px 20px", background: "#f1f5f9", color: "#475569", borderRadius: "8px", border: "1px solid #e2e8f0", cursor: "pointer", fontWeight: "600", whiteSpace: "nowrap" }}>Clear</button>
        </form>

        {total > 0 && (
          <button onClick={handleClearAll} disabled={clearing} style={{
            padding: "10px 20px", background: "#fee2e2", color: "#ef4444",
            borderRadius: "8px", border: "1px solid #fca5a5",
            cursor: clearing ? "not-allowed" : "pointer", fontWeight: "bold",
            whiteSpace: "nowrap"
          }}>
            {clearing ? "Clearing..." : "🗑️ Clear All Records"}
          </button>
        )}
      </div>

      {/* ── UPLOAD ZONE ── */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? "#2563eb" : isUploading ? "#60a5fa" : "#93c5fd"}`,
          borderRadius: "14px", padding: "28px 24px", textAlign: "center",
          background: dragOver ? "#eff6ff" : isUploading ? "#f0f7ff" : "#f8faff",
          cursor: isUploading ? "default" : "pointer",
          marginBottom: "20px", transition: "all 0.2s ease",
        }}
      >
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }}
          onChange={(e) => handleFileUpload(e.target.files[0])} />

        {!uploadState && (
          <div>
            <div style={{ fontSize: "2.5rem", marginBottom: "10px" }}>📊</div>
            <p style={{ color: "#1e40af", fontWeight: 700, fontSize: "1.05rem", margin: 0 }}>Drag & Drop Excel File</p>
            <p style={{ color: "#64748b", margin: "6px 0 12px", fontSize: "0.88rem" }}>or click to browse — .xlsx / .xls (Total: {total} records)</p>
            <span style={{ padding: "8px 20px", background: "#2563eb", color: "white", borderRadius: "8px", fontWeight: 600, fontSize: "0.88rem" }}>
              📁 Choose File
            </span>
          </div>
        )}

        {uploadState && uploadState.status === "uploading" && (
          <p style={{ color: "#2563eb", fontWeight: 600, margin: 0 }}>⏳ Reading Excel file...</p>
        )}

        {uploadState && uploadState.status === "processing" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "0.88rem", fontWeight: 600 }}>
              <span style={{ color: "#1e40af" }}>⚡ Uploading... {uploadState.pct}%</span>
              <span style={{ color: "#475569" }}>{uploadState.inserted.toLocaleString()} / {uploadState.total.toLocaleString()} records</span>
            </div>
            <div style={{ background: "#dbeafe", borderRadius: "999px", height: "14px", overflow: "hidden", marginBottom: "10px" }}>
              <div style={{
                height: "100%", borderRadius: "999px",
                background: "linear-gradient(90deg, #2563eb, #60a5fa)",
                width: `${uploadState.pct}%`,
                transition: "width 0.4s ease",
                boxShadow: "0 0 8px rgba(37,99,235,0.4)"
              }} />
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: "24px", fontSize: "0.83rem", color: "#475569" }}>
              <span>✅ Inserted: <strong>{uploadState.inserted.toLocaleString()}</strong></span>
              <span>⏭ Skipped: <strong>{uploadState.skipped.toLocaleString()}</strong></span>
              <span>⚡ Speed: <strong>{uploadState.speed.toLocaleString()} rec/s</strong></span>
              {uploadState.eta !== null && <span>⏱ ETA: <strong>{uploadState.eta}s</strong></span>}
            </div>
          </div>
        )}

        {uploadState && uploadState.status === "done" && (
          <div>
            <div style={{ fontSize: "2.5rem", marginBottom: "8px" }}>✅</div>
            <p style={{ color: "#16a34a", fontWeight: 700, fontSize: "1.05rem", margin: 0 }}>Upload Complete!</p>
            <p style={{ color: "#64748b", margin: "6px 0 0", fontSize: "0.88rem" }}>
              {uploadState.inserted.toLocaleString()} inserted · {uploadState.skipped.toLocaleString()} skipped
            </p>
            <button onClick={(e) => { e.stopPropagation(); setUploadState(null); }} style={{ marginTop: "10px", padding: "7px 18px", background: "#2563eb", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "0.88rem" }}>
              Upload Another
            </button>
          </div>
        )}
      </div>

      <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "8px", padding: "10px 16px", marginBottom: "16px", fontSize: "0.8rem", color: "#0369a1" }}>
        <strong>📋 Expected Excel Columns:</strong>
        <span style={{ marginLeft: "8px" }}>ID / Registration No · CTU ID · Name · Email · Phone number · School · program · batch (20xx - 20xx) · Type</span>
      </div>

      <div className="table-container" style={{ overflowX: "auto", maxWidth: "100%" }}>
        <table className="grievance-table" style={{ width: "100%", minWidth: "1300px" }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>CTU ID</th>
              <th>Full Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>School</th>
              <th>Program</th>
              <th>Batch</th>
              <th>Type</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isAdding && (
              <tr style={{ background: "#f0fdf4" }}>
                <td><input type="text" name="id" value={newRow.id} onChange={handleNewRowChange} placeholder="ID" style={tableInputStyle} /></td>
                <td><input type="text" name="ctuId" value={newRow.ctuId} onChange={handleNewRowChange} placeholder="CTU ID" style={tableInputStyle} /></td>
                <td><input type="text" name="fullName" value={newRow.fullName} onChange={handleNewRowChange} placeholder="Name" style={tableInputStyle} /></td>
                <td><input type="email" name="email" value={newRow.email} onChange={handleNewRowChange} placeholder="Email" style={tableInputStyle} /></td>
                <td><input type="text" name="phone" value={newRow.phone} onChange={handleNewRowChange} placeholder="Phone" style={tableInputStyle} /></td>
                <td><input type="text" name="school" value={newRow.school} onChange={handleNewRowChange} placeholder="School" style={tableInputStyle} /></td>
                <td><input type="text" name="program" value={newRow.program} onChange={handleNewRowChange} placeholder="Program" style={tableInputStyle} /></td>
                <td><input type="text" name="batch" value={newRow.batch} onChange={handleNewRowChange} placeholder="Batch" style={tableInputStyle} /></td>
                <td><input type="text" name="studentType" value={newRow.studentType} onChange={handleNewRowChange} placeholder="Type" style={tableInputStyle} /></td>
                <td>
                  <button onClick={handleAddNew} style={{ padding: "6px 12px", background: "#16a34a", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>Save</button>
                </td>
              </tr>
            )}

            {/* Existing Records */}
            {loading ? (
              <tr><td colSpan="10" style={{ textAlign: "center", padding: "20px" }}>Loading records...</td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan="10" style={{ textAlign: "center", padding: "20px" }}>No student records found.</td></tr>
            ) : (
              records.map(record => (
                <tr key={record.id}>
                  {editingId === record.id ? (
                    <>
                      {/* Editable Row */}
                      <td><input type="text" value={editFormData.id} disabled style={{...tableInputStyle, background: "#f1f5f9"}} /></td>
                      <td><input type="text" name="ctuId" value={editFormData.ctuId || ""} onChange={handleEditChange} style={tableInputStyle} /></td>
                      <td><input type="text" name="fullName" value={editFormData.fullName || ""} onChange={handleEditChange} style={tableInputStyle} /></td>
                      <td><input type="email" name="email" value={editFormData.email || ""} onChange={handleEditChange} style={tableInputStyle} /></td>
                      <td><input type="text" name="phone" value={editFormData.phone || ""} onChange={handleEditChange} style={tableInputStyle} /></td>
                      <td><input type="text" name="school" value={editFormData.school || ""} onChange={handleEditChange} style={tableInputStyle} /></td>
                      <td><input type="text" name="program" value={editFormData.program || ""} onChange={handleEditChange} style={tableInputStyle} /></td>
                      <td><input type="text" name="batch" value={editFormData.batch || ""} onChange={handleEditChange} style={tableInputStyle} /></td>
                      <td><input type="text" name="studentType" value={editFormData.studentType || ""} onChange={handleEditChange} style={tableInputStyle} /></td>
                      <td style={{ display: 'flex', gap: '5px' }}>
                        <button onClick={() => handleSaveEdit(record.id)} style={{ padding: "6px 12px", background: "#3b82f6", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>💾</button>
                        <button onClick={handleCancelEdit} style={{ padding: "6px 12px", background: "#ef4444", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>✖</button>
                      </td>
                    </>
                  ) : (
                    <>
                      {/* Normal View Row */}
                      <td onDoubleClick={() => handleEditClick(record)} style={{ fontWeight: "bold" }}>{record.id}</td>
                      <td onDoubleClick={() => handleEditClick(record)}>{record.ctuId || "-"}</td>
                      <td onDoubleClick={() => handleEditClick(record)}>{record.fullName || "-"}</td>
                      <td onDoubleClick={() => handleEditClick(record)}>{record.email || "-"}</td>
                      <td onDoubleClick={() => handleEditClick(record)}>{record.phone || "-"}</td>
                      <td onDoubleClick={() => handleEditClick(record)}>{record.school || "-"}</td>
                      <td onDoubleClick={() => handleEditClick(record)}>{record.program || "-"}</td>
                      <td onDoubleClick={() => handleEditClick(record)}>{record.batch || "-"}</td>
                      <td onDoubleClick={() => handleEditClick(record)}>{record.studentType || "-"}</td>
                      <td style={{ display: 'flex', gap: '5px' }}>
                        <button onClick={() => handleEditClick(record)} style={{ padding: "6px 12px", background: "#e2e8f0", border: "none", borderRadius: "4px", cursor: "pointer" }}>Edit</button>
                        <button onClick={() => handleDelete(record.id)} style={{ padding: "6px", background: "#fee2e2", border: "none", borderRadius: "4px", cursor: "pointer", color: "#ef4444" }}>
                          <TrashIcon width="16" height="16" />
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {!loading && totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "20px" }}>
          <div>Showing page {page} of {totalPages} ({total} total records)</div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))} 
              disabled={page === 1}
              style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #cbd5e1", background: page === 1 ? "#f1f5f9" : "white", cursor: page === 1 ? "not-allowed" : "pointer" }}
            >
              Previous
            </button>
            <button 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
              disabled={page === totalPages}
              style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #cbd5e1", background: page === totalPages ? "#f1f5f9" : "white", cursor: page === totalPages ? "not-allowed" : "pointer" }}
            >
              Next
            </button>
          </div>
        </div>
      )}
      
      <p style={{ marginTop: "10px", fontSize: "0.85rem", color: "#64748b", fontStyle: "italic" }}>
        * Tip: You can double-click on any cell to quickly edit the row.
      </p>
    </div>
  );
};

export default AdminStudentRecords;
