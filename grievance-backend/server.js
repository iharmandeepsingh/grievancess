// server.js — Final Optimized: MongoDB + Twilio + GridFS + Excel Validation + Dynamic Roles
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import twilio from "twilio";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import nodemailer from "nodemailer";
import { Readable } from "stream";
import xlsx from "xlsx";


// ✅ IMPORTS FOR FILE UPLOAD
import Grid from "gridfs-stream";
import multer from "multer";

// Modular DB and routes
import grievanceExportRoutes from "./routes/grievanceExport.js";
import connectDB from "./config/db.js";
import grievanceRoutes from "./routes/grievanceRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import staffRecordRoutes from "./routes/staffRecordRoutes.js"; // NEW: Staff Records Routes
import issueRoutes from "./routes/issueRoutes.js"; // NEW: Issue Type Routes
import routingRuleRoutes from "./routes/routingRuleRoutes.js"; // NEW: Routing Rule Routes
import staffPoolRoutes from "./routes/staffPoolRoutes.js"; // NEW: Staff Pool Routes
import UniversityRecord from "./models/UniversityRecord.js"; // Legacy Backup
import StudentRecord from "./models/StudentRecord.js"; // NEW: Student Records
import StaffRecord from "./models/StaffRecord.js"; // NEW: Staff/Admin Records
import StudentUser from "./models/StudentUser.js"; // NEW: Student Users
import StaffUser from "./models/StaffUser.js"; // NEW: Staff/Admin Users
import Grievance from "./models/GrievanceModel.js"; // Import Grievance Model
import { hideGrievance } from "./controllers/grievanceController.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();

// ------------------ 1️⃣ Middleware ------------------
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:3001"],
  credentials: true,
}));
app.use(express.json());

// ------------------ REGISTER ROUTES ------------------
app.use("/api/staff-records", staffRecordRoutes);
app.use("/api/issue-types", issueRoutes); // NEW: Issue Type Routes
app.use("/api/routing-rules", routingRuleRoutes); // NEW: Routing Rule Routes
app.use("/api/staff-pool", staffPoolRoutes); // NEW: Staff Pool Routes

// ------------------ 2️⃣ Database & GridFS Init ------------------
connectDB();

const conn = mongoose.connection;
let gfs, gridfsBucket;

conn.once("open", async () => {
  // Init Stream
  gridfsBucket = new mongoose.mongo.GridFSBucket(conn.db, {
    bucketName: "uploads"
  });
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection("uploads");
  console.log("✅ GridFS Initialized (Native Streaming Mode)");

  // ⚠️ AUTO-FIX: Drop 'email_1' index to allow testing with same email
  try {
    const collection = conn.db.collection("users");
    const indexes = await collection.indexes();
    const emailIndex = indexes.find(idx => idx.name === "email_1");

    if (emailIndex) {
      await collection.dropIndex("email_1");
      console.log("🔥 FIX APPLIED: Dropped unique email index (Testing Mode ON)");
    }
  } catch (err) {
    console.log("ℹ️ Index check skipped:", err.message);
  }

  // ✅ SEEDING: Ensure Master Admin Exists
  try {
    const User = mongoose.model("User");
    const masterExists = await User.findOne({ isMasterAdmin: true });
    if (!masterExists) {
      // Fallback: If no master admin, set ID '10001' as Master
      const defaultMasterParams = { id: "10001" };
      const updated = await User.findOneAndUpdate(
        defaultMasterParams,
        { $set: { isMasterAdmin: true, role: "admin" } },
        { new: true }
      );
      if (updated) {
        console.log(`👑 MASTER ADMIN SEEDED: User ${updated.id} is now Master Admin.`);
      } else {
        console.log("⚠️ No Master Admin found and default ID '10001' not in DB yet.");
      }
    } else {
      console.log(`✅ Master Admin Policy check passed.`);
    }
  } catch (err) {
    console.error("❌ Seeding Error:", err);
  }
});

// ------------------ MIDDLWARE: VERIFY TOKEN ------------------
const verifyToken = (req, res, next) => {
  const token = req.header("Authorization");
  if (!token) return res.status(401).json({ message: "Access Denied: No Token Provided" });

  try {
    const tokenBody = token.replace("Bearer ", "");
    const verified = jwt.verify(tokenBody, process.env.JWT_SECRET || "fallback_secret_key_123");
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ message: "Invalid Token" });
  }
};

// ==================== 🔐 OTP LOGGER ====================
global.logOTP = (type, email, otp, phone = null) => {
  console.log("\n" + "=".repeat(60));
  console.log("🔐 OTP GENERATED");
  console.log("=".repeat(60));
  console.log(`📧 Type     : ${type}`);
  console.log(`✉️  Email    : ${email}`);
  console.log(`🔑 OTP      : ${otp}`);
  if (phone) console.log(`📱 Phone OTP: ${phone}`);
  console.log(`⏰ Time     : ${new Date().toLocaleString()}`);
  console.log("=".repeat(60) + "\n");
};

// ✅ STORAGE ENGINE (Disk Storage for file management)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const originalName = file.originalname;
    cb(null, `${timestamp}_${originalName}`);
  }
});
const upload = multer({ storage });

// ------------------ 3️⃣ Email & Twilio Config ------------------
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const twilioClient = process.env.TWILIO_SID && process.env.TWILIO_TOKEN
  ? twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN)
  : null;

// ------------------ 4️⃣ User & OTP Models (Inline Definition) ------------------
const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  role: { type: String, enum: ["student", "staff", "admin"], required: true },
  fullName: String,
  email: { type: String, required: true },
  phone: String,
  password: { type: String, required: true },
  program: String,
  studentType: String,
  staffDepartment: { type: String, default: "" },

  // ✅ DYNAMIC ADMIN FIELDS
  isDeptAdmin: { type: Boolean, default: false },
  adminDepartment: { type: String, default: "" },
  isMasterAdmin: { type: Boolean, default: false } // 🔥 Added for Transferable Ownership
});

const otpSchema = new mongoose.Schema({
  userId: String,
  email: String,
  phone: String,
  otp: String,
  expiresAt: Number,
});

const User = mongoose.models.User || mongoose.model("User", userSchema);
const OTP = mongoose.models.OTP || mongoose.model("OTP", otpSchema);

// ------------------ 5️⃣ ADMIN FEATURES (🔥 FIXED ROUTES & LOGIC) ------------------

// A. Upload Excel Records (Separated: Student vs Staff)
// Excel Headers: ID, Name, Email, Role, Department, Program, StudentType
app.post("/api/admin/upload-records", verifyToken, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    console.log(`\n📂 Processing file: ${req.file.originalname}`);

    // Read from disk instead of buffer
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    console.log(`📊 Total rows in Excel: ${data.length}`);

    let studentCount = 0;
    let staffCount = 0;
    let skippedRecords = [];

    // 🔥 BATCH PROCESSING for large files
    const BATCH_SIZE = 500;
    const studentBatch = [];
    const staffBatch = [];
    const universityBatch = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];

      // 🔥 Case-insensitive column mapping
      const rowId = row.ID || row.id || row.Id;  // Main ID column
      const rowCtuId = row["CTU ID"] || row["ctu id"] || row["CTU id"] || row["Ctu Id"] || null;  // CTU ID is separate
      const rowEmail = row.Email || row.email || row.EMAIL;
      const rowName = row.Name || row.name || row.NAME;
      const rowPhone = row.Phone || row.phone || row.PHONE || row["Phone no."] || row["Phone no"] || row["PHONE NO."] || row["phone no."];
      const rowRole = row.Role || row.role || row.ROLE;
      const rowDepartment = row.Department || row.department || row.DEPARTMENT;
      const rowProgram = row.Program || row.program || row.PROGRAM;
      const rowStudentType = row.StudentType || row.studentType || row.studenttype;
      const rowSchool = row.School || row.school || row.SCHOOL;
      const rowBatch = row.batch || row.Batch || row.BATCH;

      // 🔥 Only ID is required for verification - email, phone etc are optional
      if (rowId) {
        const safeId = rowId.toString().trim().toUpperCase();
        const safeCtuId = rowCtuId ? rowCtuId.toString().trim() : null;
        const safeEmail = rowEmail ? rowEmail.toString().toLowerCase().trim() : "";  // Email optional
        const idLength = safeId.length;
        const excelRole = rowRole ? rowRole.toLowerCase().trim() : "";
        let detectedRole = null;

        // 🔥 FIX: Staff/Admin detection - Role based, NO ID length restriction
        if (excelRole === "staff" || excelRole === "admin") {
          detectedRole = "staff";
        }
        // Check Student: ID length exactly 8 OR role is explicitly "student"
        else if (idLength === 8 || excelRole === "student") {
          detectedRole = "student";
        }
        // Invalid case: Missing role and not 8-digit student ID
        else {
          skippedRecords.push({
            id: safeId,
            email: safeEmail || "N/A",
            reason: `Role="${excelRole || 'missing'}" and ID is not 8 digits (Student). For staff/admin, add Role column.`
          });
          continue;
        }

        // Prepare batch operations
        if (detectedRole === "student") {
          studentBatch.push({
            updateOne: {
              filter: { id: safeId },
              update: {
                $set: {
                  id: safeId,
                  ctuId: safeCtuId,
                  fullName: rowName ? rowName.toString().trim() : "",
                  email: safeEmail,
                  phone: rowPhone ? rowPhone.toString().trim() : "",
                  program: rowProgram ? rowProgram.toString().trim() : "",
                  studentType: rowStudentType ? rowStudentType.toString().trim() : "",
                  school: rowSchool ? rowSchool.toString().trim() : "",
                  batch: rowBatch ? rowBatch.toString().trim() : ""
                }
              },
              upsert: true
            }
          });
          studentCount++;
        } else if (detectedRole === "staff") {
          const finalRole = (excelRole === "admin") ? "admin" : "staff";
          staffBatch.push({
            updateOne: {
              filter: { id: safeId },
              update: {
                $set: {
                  id: safeId,
                  fullName: rowName ? rowName.toString().trim() : "",
                  email: safeEmail,
                  phone: rowPhone ? rowPhone.toString().trim() : "",
                  role: finalRole,
                  department: rowDepartment ? rowDepartment.toString().trim() : ""
                }
              },
              upsert: true
            }
          });
          staffCount++;
        }

        // Legacy backup
        universityBatch.push({
          updateOne: {
            filter: { id: safeId },
            update: {
              $set: {
                id: safeId,
                fullName: rowName ? rowName.toString().trim() : "",
                email: safeEmail,
                role: detectedRole,
                department: rowDepartment ? rowDepartment.toString().trim() : "",
                program: rowProgram ? rowProgram.toString().trim() : ""
              }
            },
            upsert: true
          }
        });

        // 🔥 Process batch when size reached
        if (studentBatch.length >= BATCH_SIZE) {
          await StudentRecord.bulkWrite(studentBatch);
          console.log(`✅ Processed ${studentBatch.length} students (batch)`);
          studentBatch.length = 0;
        }
        if (staffBatch.length >= BATCH_SIZE) {
          await StaffRecord.bulkWrite(staffBatch);
          console.log(`✅ Processed ${staffBatch.length} staff (batch)`);
          staffBatch.length = 0;
        }
        if (universityBatch.length >= BATCH_SIZE) {
          await UniversityRecord.bulkWrite(universityBatch);
          universityBatch.length = 0;
        }
      }

      // Log progress every 1000 records
      if ((i + 1) % 1000 === 0) {
        console.log(`⏳ Progress: ${i + 1}/${data.length} rows processed...`);
      }
    }

    // 🔥 Process remaining records in final batch
    if (studentBatch.length > 0) {
      await StudentRecord.bulkWrite(studentBatch);
      console.log(`✅ Processed ${studentBatch.length} students (final batch)`);
    }
    if (staffBatch.length > 0) {
      await StaffRecord.bulkWrite(staffBatch);
      console.log(`✅ Processed ${staffBatch.length} staff (final batch)`);
    }
    if (universityBatch.length > 0) {
      await UniversityRecord.bulkWrite(universityBatch);
    }

    console.log(`\n📊 UPLOAD COMPLETE: ${studentCount} Students, ${staffCount} Staff, ${skippedRecords.length} Skipped`);

    res.json({
      message: `✅ Processed: ${studentCount} Students, ${staffCount} Staff/Admin records.${skippedRecords.length > 0 ? ` ⚠️ ${skippedRecords.length} records skipped.` : ""}`,
      students: studentCount,
      staff: staffCount,
      skipped: skippedRecords.length,
      skippedDetails: skippedRecords.slice(0, 50) // Limit to first 50 for response size
    });
  } catch (err) {
    console.error("Excel Upload Error:", err);
    res.status(500).json({ message: "Error processing Excel file" });
  }
});

// A1. Get list of uploaded files (placeholder - needs file tracking implementation)
app.get("/api/admin/uploaded-files", verifyToken, async (req, res) => {
  try {
    const uploadsDir = path.join(__dirname, 'uploads');

    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const files = fs.readdirSync(uploadsDir).map(filename => {
      const stats = fs.statSync(path.join(uploadsDir, filename));
      return {
        filename,
        uploadDate: stats.mtime,
        size: stats.size
      };
    });

    res.json({ files });
  } catch (err) {
    console.error("Error fetching files:", err);
    res.status(500).json({ message: "Error fetching files" });
  }
});

// A2. Download uploaded file
app.get("/api/admin/download-file/:filename", verifyToken, (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, 'uploads', filename);

    if (fs.existsSync(filePath)) {
      res.download(filePath);
    } else {
      res.status(404).json({ message: "File not found" });
    }
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).json({ message: "Error downloading file" });
  }
});

// A3. Preview file
app.get("/api/admin/preview-file/:filename", verifyToken, (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, 'uploads', filename);

    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ message: "File not found" });
    }
  } catch (err) {
    console.error("Preview error:", err);
    res.status(500).json({ message: "Error previewing file" });
  }
});

// A4. Export all users to Excel
app.get("/api/admin/export-users", verifyToken, async (req, res) => {
  try {
    const users = await User.find({}).select('id fullName email phone role department program isDeptAdmin adminDepartment');

    const data = users.map(user => ({
      ID: user.id,
      Name: user.fullName,
      Email: user.email,
      Phone: user.phone || 'N/A', // Add Phone Number
      Role: user.role,
      Department: user.department || user.adminDepartment || '',
      Program: user.program || '',
      'Is Dept Admin': user.isDeptAdmin ? 'Yes' : 'No'
    }));

    const worksheet = xlsx.utils.json_to_sheet(data);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Users');

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename=users_export.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    console.error("Export error:", err);
    res.status(500).json({ message: "Error exporting users" });
  }
});

// A5. Get all users as JSON
app.get("/api/admin/all-users", verifyToken, async (req, res) => {
  try {
    const users = await User.find({}).select('id fullName email phone role department program isDeptAdmin adminDepartment isMasterAdmin');
    res.json(users);
  } catch (err) {
    console.error("Fetch all users error:", err);
    res.status(500).json({ message: "Error fetching all users" });
  }
});

// ✅ B. Promote/Demote Staff (HIERARCHY FIXED)
// New Route Name: /api/admin-staff/role (Matches Frontend)
app.post("/api/admin-staff/role", verifyToken, async (req, res) => {
  try {
    const { targetStaffId, action, department } = req.body;

    // 1. Requester Validation (From Token)
    const requesterId = req.user.id;
    const requester = await User.findOne({ id: requesterId });

    if (!requester) return res.status(403).json({ message: "❌ Access Denied" });

    // DEBUG LOG ADDED
    console.log(`🔍 ROLE CHECK: Requester: ${requester.id} (${requester.fullName})`);
    console.log(`   ➤ isMasterAdmin (DB): ${requester.isMasterAdmin}`);
    console.log(`   ➤ isDeptAdmin (DB): ${requester.isDeptAdmin}`);
    console.log(`   ➤ Token Payload Master: ${req.user.isMasterAdmin}`);

    // Master Admin Check (Database Driven)
    const isMaster = requester.isMasterAdmin;
    const isDeptAdmin = requester.isDeptAdmin;

    // Permissions Check
    if (!isMaster && !isDeptAdmin) {
      return res.status(403).json({ message: "❌ Access Denied: Insufficient Permissions" });
    }

    // Dept Admin Restriction: Can only add to own department
    if (!isMaster && isDeptAdmin) {
      if (action === "promote" && department !== requester.adminDepartment) {
        return res.status(403).json({ message: `❌ You can only manage staff for ${requester.adminDepartment}.` });
      }
    }

    // 2. Find Target Staff
    const safeTargetId = targetStaffId.toString().trim().toUpperCase();
    const targetMember = await User.findOne({ id: safeTargetId });

    if (!targetMember) return res.status(404).json({ message: "Target staff member not found." });

    // Dept Admin Restriction: Cannot remove other Dept Admins
    if (!isMaster && isDeptAdmin && action === "demote") {
      if (targetMember.adminDepartment !== requester.adminDepartment) {
        return res.status(403).json({ message: "❌ You cannot manage staff of other departments." });
      }
    }

    // 3. Perform Action
    if (action === "promote") {
      // 🔥 NEW: Check if another admin already exists for this department
      if (isMaster) {
        // Master promoting someone to Admin -> Check if dept already has an admin
        const existingAdmin = await User.findOne({
          // role: "staff", // ❌ REMOVED: Existing admins have role="admin", so this was failing
          adminDepartment: department,
          isDeptAdmin: true,
          id: { $ne: safeTargetId } // Exclude current target
        });

        if (existingAdmin) {
          // Remove the old admin
          existingAdmin.isDeptAdmin = false;
          existingAdmin.adminDepartment = "";
          existingAdmin.role = "staff"; // ✅ Reset role to staff
          await existingAdmin.save();
          console.log(`🔄 Removed ${existingAdmin.fullName} from Admin role for ${department}`);

          // ✅ SEND DEMOTION EMAIL TO DISPLACED ADMIN
          const demotionDate = new Date().toLocaleString("en-IN", {
            day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata"
          });

          const demotionEmailBody = `
            <h2 style="color: #64748b;">Role Update Notification</h2>
            <p>Dear ${existingAdmin.fullName},</p>
            <p>This is to respectfully inform you that your administrative responsibilities for <strong>${department}</strong> have been concluded as a new Admin has been appointed.</p>
            <p>You have been reassigned as a <strong>General Staff</strong> member.</p>
            <p><strong>Date & Time:</strong> ${demotionDate}</p>
            <p>We sincerely appreciate your contributions and leadership during your tenure.</p>
            <div style="background: #fef3c7; padding: 15px; border-radius: 8px; border: 1px solid #f59e0b; color: #92400e; margin-top: 10px;">
              <strong>ℹ️ Note:</strong> Please use the <strong>'Staff'</strong> option to login from now on.
            </div>
          `;

          // 🔥 ASYNC EMAIL (Fire and Forget)
          transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: existingAdmin.email,
            subject: `Role Update - ${department} (Ref: ${Date.now().toString().slice(-4)})`,
            html: demotionEmailBody
          }).then(() => console.log(`✅ Demotion email sent to displaced admin ${existingAdmin.email}`))
            .catch(emailErr => console.error("⚠️ Email sending failed:", emailErr));
        }
      }

      targetMember.adminDepartment = department;

      // 🔥 CRITICAL HIERARCHY FIX 🔥
      // Agar Master Admin kar raha hai -> Boss (Admin) banao
      // Agar Dept Admin kar raha hai -> Team Member (Staff) banao
      if (isMaster) {
        targetMember.isDeptAdmin = true;
        targetMember.role = "admin"; // 🔥 Change role to admin
      } else {
        targetMember.isDeptAdmin = false;
        targetMember.role = "staff"; // Keep as staff (team member)
      }

      await targetMember.save();

      // ✅ SEND PROMOTION EMAIL
      const promotionDate = new Date().toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata"
      });

      const newRole = targetMember.isDeptAdmin ? "Department Admin" : "Admin Staff";

      // ✅ Login Instruction for Admins
      const loginInstruction = targetMember.isDeptAdmin
        ? "<br><br><strong>👉 Please select 'Admin' option while logging in.</strong>"
        : "";

      const emailBody = `
        <h2 style="color: #2563eb;">Congratulations!</h2>
        <p>Dear ${targetMember.fullName},</p>
        <p>You have been promoted to <strong>${newRole}</strong> for <strong>${department}</strong>.</p>
        <p><strong>Date & Time:</strong> ${promotionDate}</p>
        <p><strong>Staff ID:</strong> ${targetMember.id}</p>
        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; border: 1px solid #f59e0b; color: #92400e; margin-top: 10px;">
          <strong>⚠️ Important:</strong> Please logout and login again to see your new dashboard.${loginInstruction}
        </div>
      `;

      // 🔥 ASYNC EMAIL (Fire and Forget)
      transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: targetMember.email,
        subject: `🎉 Promotion Notification - ${newRole}`,
        html: emailBody
      }).then(() => console.log(`✅ Promotion email sent to ${targetMember.email}`))
        .catch(emailErr => console.error("⚠️ Email sending failed:", emailErr));

      const title = targetMember.isDeptAdmin ? "Admin" : "Team Member";
      res.json({ message: `✅ ${targetMember.fullName} is now ${title} of ${department}` });

    } else if (action === "demote") {
      const oldDept = targetMember.adminDepartment || "your department"; // Capture dept name
      targetMember.isDeptAdmin = false;
      targetMember.adminDepartment = "";
      targetMember.role = "staff"; // 🔥 Change role back to staff
      await targetMember.save();

      // 🔥 RESET ASSIGNED GRIEVANCES TO PENDING
      const updateResult = await Grievance.updateMany(
        {
          assignedTo: safeTargetId,
          status: { $nin: ["Resolved", "Rejected"] }
        },
        {
          $set: { status: "Pending", assignedTo: null, assignedRole: null, assignedBy: null, deadlineDate: null }
        }
      );

      console.log(`🔄 Reset ${updateResult.modifiedCount} grievances for demoted staff ${safeTargetId}`);

      // ✅ SEND DEMOTION EMAIL
      const demotionDate = new Date().toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata"
      });

      const demotionEmailBody = `
        <h2 style="color: #64748b;">Role Update Notification</h2>
        <p>Dear ${targetMember.fullName},</p>
        <p>This is to respectfully inform you that your administrative responsibilities for <strong>${oldDept}</strong> have been concluded.</p>
        <p>You have been reassigned as a <strong>General Staff</strong> member.</p>
        <p><strong>Date & Time:</strong> ${demotionDate}</p>
        <p>We sincerely appreciate your contributions and leadership during your tenure.</p>
        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; border: 1px solid #f59e0b; color: #92400e; margin-top: 10px;">
          <strong>ℹ️ Note:</strong> Please use the <strong>'Staff'</strong> option to login from now on.
        </div>
      `;

      // 🔥 ASYNC EMAIL (Fire and Forget)
      transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: targetMember.email,
        subject: `Role Update - ${oldDept} (Ref: ${Date.now().toString().slice(-4)})`,
        html: demotionEmailBody
      }).then(() => console.log(`✅ Demotion email sent to ${targetMember.email}`))
        .catch(emailErr => console.error("⚠️ Email sending failed:", emailErr));

      res.json({ message: `✅ ${targetMember.fullName} removed from department role. ${updateResult.modifiedCount} grievances reset to Pending.` });
    } else {
      res.status(400).json({ message: "Invalid action" });
    }

  } catch (err) {
    console.error("Role Management Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

// ✅ C. Get All Staff List (ROUTE NAME FIXED)
// New Route Name: /api/admin-staff/all (Matches Frontend)
app.get("/api/admin-staff/all", async (req, res) => {
  try {
    // Fetch: 
    // 1. All staff (role = "staff")
    // 2. All admins (role = "admin")
    // 3. Exclude Master Admin (id = 10001)
    const staffList = await User.find({
      isMasterAdmin: { $ne: true }, // Exclude Master Admin
      role: { $in: ["staff", "admin"] } // Include both staff and admin roles
    }).select("id fullName email isDeptAdmin adminDepartment role");

    res.json(staffList);
  } catch (err) {
    console.error("Staff fetch error:", err);
    res.status(500).json({ message: "Error fetching staff list" });
  }
});

// D. Get Department Specific Staff
app.get("/api/admin/staff/:department", verifyToken, async (req, res) => {
  try {
    const { department } = req.params;
    // Fetch ANYONE in that department (Boss or Team Member)
    const staff = await User.find({
      role: "staff",
      adminDepartment: department
    }).select("id fullName");

    res.json(staff);
  } catch (err) {
    res.status(500).json({ message: "Error fetching department staff" });
  }
});

// 🔥 NEW: Transfer Ownership Route
app.post("/api/admin/transfer-ownership", verifyToken, async (req, res) => {
  try {
    const { newMasterId } = req.body;
    const requesterId = req.user.id;

    // 1. Verify Request is from Current Master Admin
    const currentMaster = await User.findOne({ id: requesterId, isMasterAdmin: true });
    if (!currentMaster) {
      return res.status(403).json({ message: "❌ Only the Master Admin can transfer ownership." });
    }

    // 2. Validate New Master ID
    const safeTargetId = newMasterId.toString().trim().toUpperCase();
    if (safeTargetId === requesterId) {
      return res.status(400).json({ message: "You are already the Master Admin." });
    }

    const newMaster = await User.findOne({ id: safeTargetId });
    if (!newMaster) {
      return res.status(404).json({ message: "Target user not found." });
    }

    // 3. ATOMIC TRANSFER
    // Demote Current
    currentMaster.isMasterAdmin = false;
    currentMaster.role = "staff"; // 🔥 DEMOTE TO STAFF (User Requested)

    // Promote New
    newMaster.isMasterAdmin = true;
    newMaster.role = "admin";
    newMaster.isDeptAdmin = false; // Master is above Dept Admin
    newMaster.adminDepartment = ""; // Master has no specific Dept

    await currentMaster.save();
    await newMaster.save();

    console.log(`👑 Ownership Transferred: ${currentMaster.fullName} -> ${newMaster.fullName}`);

    res.json({ message: `✅ Ownership successfully transferred to ${newMaster.fullName} (${newMaster.id})` });

  } catch (err) {
    console.error("Transfer Error:", err);
    res.status(500).json({ message: "Transfer failed" });
  }
});

// ------------------ 8️⃣ FILE UPLOAD (Disk → GridFS Stream) ------------------

app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    console.error("❌ [UPLOAD] No file found in request body");
    return res.status(400).json({ message: "No file uploaded" });
  }

  const filename = `${Date.now()}-${req.file.originalname}`;

  // ✅ FIX: Read from disk path (diskStorage saves to disk, NOT buffer)
  const readableStream = fs.createReadStream(req.file.path);

  const uploadStream = gridfsBucket.openUploadStream(filename, { contentType: req.file.mimetype });
  readableStream.pipe(uploadStream);

  uploadStream.on("error", (err) => {
    console.error("❌ [UPLOAD] Stream Error:", err);
    // Clean up temp file on error
    fs.unlink(req.file.path, () => {});
    res.status(500).json({ message: "Error uploading file" });
  });

  uploadStream.on("finish", () => {
    // ✅ Clean up temp file after successful GridFS upload
    fs.unlink(req.file.path, (unlinkErr) => {
      if (unlinkErr) console.warn("⚠️ Could not delete temp file:", unlinkErr.message);
    });

    console.log(`✅ [UPLOAD] File saved to GridFS: ${filename}`);
    res.json({
      filename: filename,
      fileId: uploadStream.id,
      contentType: req.file.mimetype,
      originalName: req.file.originalname
    });
  });
});

app.get("/api/file/:filename", async (req, res) => {
  try {
    //  FIX: Use gridfsBucket (Native) instead of gfs (gridfs-stream) for reliability
    const files = await gridfsBucket.find({ filename: req.params.filename }).toArray();
    if (!files || files.length === 0) return res.status(404).json({ err: "No file found" });

    const file = files[0];
    res.set("Content-Type", file.contentType);
    const readstream = gridfsBucket.openDownloadStreamByName(file.filename);
    readstream.pipe(res);
  } catch (err) {
    console.error("File download error:", err);
    res.status(500).json({ err: "Server Error" });
  }
});

// ------------------ 9️⃣ Mount Routes ------------------

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api/auth", authRoutes);
app.put("/api/grievances/hide/:id", verifyToken, hideGrievance);
app.use("/api/grievances", grievanceExportRoutes);// ✅ Soft Delete Route
app.use("/api/grievances", grievanceRoutes);
app.use("/api/chat", chatRoutes);
app.get("/", (req, res) => res.send("✅ Backend Running"));


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server: http://localhost:${PORT}`));