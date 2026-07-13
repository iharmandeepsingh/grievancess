import StudentRecord from "../models/StudentRecord.js";
import xlsx from "xlsx";
import fs from "fs";

// ─── In-memory job tracker ────────────────────────────────────────────────
const uploadJobs = new Map();
// ─────────────────────────────────────────────────────────────────────────

// ─── Smart field extractor ────────────────────────────────────────────────
const norm = (s) => String(s).toLowerCase().replace(/[\s\-_().\/]/g, "");

const findField = (row, ...keywords) => {
  const rowKeys = Object.keys(row);
  // 1) Exact normalized match
  for (const kw of keywords) {
    const kwNorm = norm(kw);
    const exactKey = rowKeys.find((k) => norm(k) === kwNorm);
    if (exactKey !== undefined && String(row[exactKey]).trim() !== "")
      return String(row[exactKey]).trim();
  }
  // 2) Partial / contains match
  for (const kw of keywords) {
    const kwNorm = norm(kw);
    const partialKey = rowKeys.find(
      (k) => norm(k).includes(kwNorm) || kwNorm.includes(norm(k))
    );
    if (partialKey !== undefined && String(row[partialKey]).trim() !== "")
      return String(row[partialKey]).trim();
  }
  return "";
};
// ─────────────────────────────────────────────────────────────────────────

// ─── Background processor (batch insertMany) ─────────────────────────────
const processUpload = async (jobId, rows) => {
  const job = uploadJobs.get(jobId);
  const BATCH = 200; // rows per batch

  try {
    let inserted = 0;
    let skipped = 0;
    let errors = [];
    let skippedRows = [];

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const docs = [];

      for (const row of batch) {
        let id = findField(row,
          "ID", "Student ID", "StudentID", "Reg No", "Registration No",
          "Reg. No", "RegNo", "UID", "Roll No", "RollNo", "Enrollment No"
        ).toUpperCase();

        // ✅ Fallback 1: use CTU ID if ID is blank
        if (!id) {
          const ctuFallback = findField(row, "CTU ID", "CTU Id", "CTUID", "ctuId", "CTU_ID", "CTU").toUpperCase();
          if (ctuFallback) id = ctuFallback;
        }

        // ✅ Fallback 2: use SR NO as generated ID if still blank
        if (!id) {
          const srNo = findField(row, "SR NO", "Sr No", "SRNO", "SR", "S.No", "S No", "Serial");
          if (srNo) id = `SRNO_${srNo}`;
        }

        // Skip ONLY if truly nothing found
        if (!id) {
          skipped++;
          skippedRows.push(row); // ← capture for debug
          continue;
        }

        docs.push({
          id,
          ctuId: findField(row, "CTU ID", "CTU Id", "CTUID", "ctuId", "CTU_ID", "CTU") || null,
          fullName: findField(row, "Name", "Full Name", "FullName", "Student Name", "StudentName", "FULL NAME", "Full name"),
          email: findField(row, "Email", "Email ID", "EmailID", "E-mail", "email", "EMAIL", "Mail").toLowerCase(),
          phone: findField(row, "Phone number", "Phone Number", "PhoneNumber", "Phone No", "PhoneNo", "Mobile", "Mobile No", "MobileNo", "Contact", "Contact No", "Phone", "Mob"),
          school: findField(row, "School", "Department", "Dept", "Faculty", "College", "School Name", "Institute"),
          program: findField(row, "program", "Program", "Programme", "Course", "Branch", "Degree", "Specialization", "Stream"),
          batch: findField(row, "batch", "Batch", "BATCH", "Academic Year", "Session", "Admission Year", "Year", "Joining Year"),
          studentType: findField(row, "Student Type", "StudentType", "Type", "Admission Type", "AdmissionType", "Category", "Mode"),
        });
      }

      if (docs.length === 0) {
        job.processed += batch.length;
        uploadJobs.set(jobId, job);
        continue;
      }

      // ✅ bulkWrite upsert — insert OR update, ZERO records lost
      try {
        const ops = docs.map((doc) => ({
          updateOne: {
            filter: { id: doc.id },
            update: { $set: doc },
            upsert: true,
          },
        }));
        const result = await StudentRecord.bulkWrite(ops, { ordered: false });
        inserted += (result.upsertedCount || 0) + (result.modifiedCount || 0);
      } catch (bulkErr) {
        if (bulkErr.result) {
          inserted += (bulkErr.result.upsertedCount || 0) + (bulkErr.result.modifiedCount || 0);
        }
        errors.push(`Batch error: ${bulkErr.message}`);
      }

      // Update progress
      job.inserted = inserted;
      job.skipped = skipped;
      job.processed = Math.min(i + BATCH, rows.length);
      uploadJobs.set(jobId, job);
    }

    job.status = "done";
    job.inserted = inserted;
    job.skipped = skipped;
    job.processed = rows.length;
    job.errors = errors.slice(0, 10);
    job.skippedRows = skippedRows;
    console.log("⚠️ Skipped rows count:", skippedRows.length);
    if (skippedRows.length > 0) {
      console.log("⚠️ Skipped rows samples:", skippedRows.slice(0, 10));
    }
    uploadJobs.set(jobId, job);
  } catch (err) {
    const job = uploadJobs.get(jobId);
    if (job) {
      job.status = "error";
      job.errorMessage = err.message;
      uploadJobs.set(jobId, job);
    }
  }
};
// ─────────────────────────────────────────────────────────────────────────

// ✅ GET all student records (paginated + search)
export const getAllStudentRecords = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || "";

    const query = {};
    if (search) {
      query.$or = [
        { id: { $regex: search, $options: "i" } },
        { ctuId: { $regex: search, $options: "i" } },
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { program: { $regex: search, $options: "i" } },
        { school: { $regex: search, $options: "i" } },
        { batch: { $regex: search, $options: "i" } },
        { studentType: { $regex: search, $options: "i" } },
      ];
    }

    const total = await StudentRecord.countDocuments(query);
    const records = await StudentRecord.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({ total, page, totalPages: Math.ceil(total / limit), records });
  } catch (error) {
    res.status(500).json({ message: "Server error fetching student records", error });
  }
};

// ✅ Upload Excel → returns jobId instantly, processes in background
export const uploadStudentRecords = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const filePath = req.file.path;
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

    try { fs.unlinkSync(filePath); } catch (_) {}

    if (!rows || rows.length === 0)
      return res.status(400).json({ message: "Excel sheet is empty or invalid" });

    const detectedHeaders = rows[0] ? Object.keys(rows[0]) : [];
    console.log("📊 Excel headers:", detectedHeaders);
    console.log("📝 Total rows:", rows.length);

    // Create job
    const jobId = `job_${Date.now()}`;
    uploadJobs.set(jobId, {
      status: "processing",
      total: rows.length,
      processed: 0,
      inserted: 0,
      skipped: 0,
      errors: [],
      detectedHeaders,
      startedAt: Date.now(),
    });

    // Return immediately with jobId
    res.json({ jobId, total: rows.length, message: "Upload started" });

    // Process in background (non-blocking)
    setImmediate(() => processUpload(jobId, rows));
  } catch (error) {
    console.error("Upload Error:", error);
    res.status(500).json({ message: "Failed to process Excel file", error: error.message });
  }
};

// ✅ GET progress for a specific upload job
export const getUploadProgress = (req, res) => {
  const { jobId } = req.params;
  const job = uploadJobs.get(jobId);
  if (!job) return res.status(404).json({ message: "Job not found" });
  res.json(job);
};

// ✅ Add a single student record
export const addStudentRecord = async (req, res) => {
  try {
    const { id, ctuId, fullName, email, phone, program, studentType, school, batch } = req.body;
    if (!id) return res.status(400).json({ message: "Student ID is required" });
    const exists = await StudentRecord.findOne({ id: id.trim().toUpperCase() });
    if (exists) return res.status(400).json({ message: "Student ID already exists" });
    const record = await StudentRecord.create({
      id: id.trim().toUpperCase(), ctuId: ctuId || null,
      fullName, email, phone, program, studentType, school, batch,
    });
    res.status(201).json({ message: "Student record added", record });
  } catch (error) {
    res.status(500).json({ message: "Failed to add record", error: error.message });
  }
};

// ✅ Delete one record
export const deleteStudentRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await StudentRecord.findOneAndDelete({ id: id.trim().toUpperCase() });
    if (!record) return res.status(404).json({ message: "Record not found" });
    res.json({ message: "Record deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete record", error: error.message });
  }
};

// ✅ Update one record
export const updateStudentRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const { ctuId, fullName, email, phone, program, studentType, school, batch } = req.body;
    
    const record = await StudentRecord.findOneAndUpdate(
      { id: id.trim().toUpperCase() },
      { ctuId: ctuId || null, fullName, email, phone, program, studentType, school, batch },
      { new: true, runValidators: true }
    );
    
    if (!record) return res.status(404).json({ message: "Record not found" });
    res.json({ message: "Record updated successfully", record });
  } catch (error) {
    res.status(500).json({ message: "Failed to update record", error: error.message });
  }
};

// ✅ Clear ALL records
export const clearAllStudentRecords = async (req, res) => {
  try {
    const result = await StudentRecord.deleteMany({});
    res.json({ message: `✅ Cleared ${result.deletedCount} records.`, deleted: result.deletedCount });
  } catch (error) {
    res.status(500).json({ message: "Failed to clear records", error: error.message });
  }
};
