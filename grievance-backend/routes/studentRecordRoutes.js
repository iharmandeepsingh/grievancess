import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import {
  getAllStudentRecords,
  uploadStudentRecords,
  addStudentRecord,
  deleteStudentRecord,
  clearAllStudentRecords,
  getUploadProgress,
  updateStudentRecord,
} from "../controllers/studentRecordController.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Temp storage for uploaded Excel files
const tempStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = path.join(__dirname, "../uploads/temp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname}`);
  },
});

const upload = multer({
  storage: tempStorage,
  fileFilter: (req, file, cb) => {
    const allowed = [".xlsx", ".xls"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only .xlsx and .xls files are allowed"));
    }
  },
});

// GET /api/student-records  — list with pagination + search
router.get("/", getAllStudentRecords);

// POST /api/student-records/upload  — Excel bulk upload (returns jobId instantly)
router.post("/upload", upload.single("file"), uploadStudentRecords);

// GET /api/student-records/progress/:jobId  — real-time progress polling
router.get("/progress/:jobId", getUploadProgress);

// POST /api/student-records  — add single record
router.post("/", addStudentRecord);

// DELETE /api/student-records/clear-all — wipe ALL records (must be BEFORE /:id)
router.delete("/clear-all", clearAllStudentRecords);

// DELETE /api/student-records/:id
router.delete("/:id", deleteStudentRecord);

// PUT /api/student-records/:id  — update single record
router.put("/:id", updateStudentRecord);

export default router;
