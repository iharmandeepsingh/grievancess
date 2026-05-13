import User from "../models/UserModel.js"; // Legacy - kept for backup
import UniversityRecord from "../models/UniversityRecord.js"; // Legacy - kept for backup
import StudentRecord from "../models/StudentRecord.js"; // NEW: Student validation
import StaffRecord from "../models/StaffRecord.js"; // NEW: Staff/Admin validation
import StudentUser from "../models/StudentUser.js"; // NEW: Student users
import StaffUser from "../models/StaffUser.js"; // NEW: Staff/Admin users
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendEmailOtp } from "../utils/emailService.js";


// ================= SMS SETUP (Innuvis API) =================
const sendSms = async (phone, otp) => {
  try {
    let formattedPhone = phone.toString().trim();
    if (formattedPhone.length === 10) {
      formattedPhone = "91" + formattedPhone;
    }

    const message = `Dear User, Your One-Time Password (OTP) for registering on the CT University Grievance Portal is: ${otp} - CTU Support Team`;
    const encodedMessage = encodeURIComponent(message);

    const url = `${process.env.SMS_API_URL}&number=${formattedPhone}&text=${encodedMessage}`;

    const response = await fetch(url);
    const data = await response.text();
    
    console.log("✅ SMS API Called for:", formattedPhone);
    console.log("✅ SMS Response:", data);
    
    return data;
  } catch (error) {
    console.error("SMS API Network Error:", error.message);
  }
};

// =================================================
// 1️⃣ REGISTER REQUEST (SEND DUAL OTP) - UPDATED FOR SEPARATED DATA
// =================================================
export const registerRequest = async (req, res) => {
  try {
    const { email, password, id, phone, role } = req.body;
    const safeId = id.toString().trim().toUpperCase();
    const userRole = role ? role.toLowerCase().trim() : "student";

    // Check if user already exists in either collection
    let existingUser = null;
    if (userRole === "student") {
      existingUser = await StudentUser.findOne({ $or: [{ email }, { id: safeId }] });
    } else {
      existingUser = await StaffUser.findOne({ $or: [{ email }, { id: safeId }] });
    }

    // Also check legacy User collection
    if (!existingUser) {
      existingUser = await User.findOne({ $or: [{ email }, { id: safeId }] });
    }

    // 🔥 TESTING MODE: User exists check DISABLED
    // TODO: RE-ENABLE THIS BEFORE PRODUCTION!
    // if (existingUser && existingUser.isVerified) {
    //   return res.status(400).json({ message: "User already exists" });
    // }

    // ✅ Validate ID against appropriate University Records
    let validRecord = null;
    if (userRole === "student") {
      validRecord = await StudentRecord.findOne({ id: safeId });
      if (!validRecord) {
        // Fallback to legacy UniversityRecord
        validRecord = await UniversityRecord.findOne({ id: safeId, role: "student" });
      }
    } else {
      validRecord = await StaffRecord.findOne({ id: safeId });
      if (!validRecord) {
        // Fallback to legacy UniversityRecord  
        validRecord = await UniversityRecord.findOne({ id: safeId, role: { $in: ["staff", "admin"] } });
      }
    }

    if (!validRecord) {
      return res.status(403).json({ message: `ID not found in University ${userRole === "student" ? "Student" : "Staff"} Records.` });
    }

    // Generate OTPs
    const phoneOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const emailOtp = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash Password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Prepare user data based on role
    const baseUserData = {
      id: safeId,
      email: email.toLowerCase().trim(),
      phone,
      password: hashedPassword,
      fullName: validRecord.fullName || req.body.fullName || "",
      otp: emailOtp,
      otpExpires: Date.now() + 10 * 60 * 1000,
      phoneOtp: phoneOtp,
      phoneOtpExpires: Date.now() + 10 * 60 * 1000,
      isVerified: false,
    };

    // Create user in appropriate collection
    if (userRole === "student") {
      const studentData = {
        ...baseUserData,
        program: validRecord.program || req.body.program || "",
        studentType: validRecord.studentType || req.body.studentType || "",
      };
      await StudentUser.findOneAndUpdate({ id: safeId }, studentData, { upsert: true, new: true });
    } else {
      const staffData = {
        ...baseUserData,
        role: validRecord.role || userRole,
        staffDepartment: validRecord.department || req.body.department || "",
        isDeptAdmin: false,
        adminDepartment: "",
        isMasterAdmin: false,
      };
      await StaffUser.findOneAndUpdate({ id: safeId }, staffData, { upsert: true, new: true });
    }

    // Also save to legacy User collection for backup
    await User.findOneAndUpdate(
      { id: safeId },
      { ...baseUserData, role: userRole, program: validRecord.program || "", staffDepartment: validRecord.department || "" },
      { upsert: true, new: true }
    );

    // 📱 Send Phone OTP via Innuvis API
    if (phone) {
      await sendSms(phone, phoneOtp);
    }

    // 📧 Send Email OTP
    if (email) {
      await sendEmailOtp(email, emailOtp);
    }

    // 🔐 Log OTP prominently in terminal
    if (global.logOTP) global.logOTP("REGISTRATION", email, emailOtp, phoneOtp);
    
    res.status(200).json({ message: `Verification codes sent to ${phone} and ${email}` });

  } catch (err) {
    console.error("Register Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// =================================================
// 2️⃣ VERIFY REGISTRATION (DUAL CHECK) - UPDATED FOR SEPARATED DATA
// =================================================
export const verifyRegistration = async (req, res) => {
  try {
    const { email, otpEmail, otpPhone } = req.body;

    // Find user in StudentUser or StaffUser
    let user = await StudentUser.findOne({ email });
    let isStudent = true;

    if (!user) {
      user = await StaffUser.findOne({ email });
      isStudent = false;
    }

    // Fallback to legacy User
    if (!user) {
      user = await User.findOne({ email });
      isStudent = null; // Unknown, use legacy
    }

    if (!user) return res.status(400).json({ message: "User not found" });

    // Validate Phone OTP
    if (user.phoneOtp !== otpPhone || user.phoneOtpExpires < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired Phone OTP" });
    }

    // Validate Email OTP
    if (user.otp !== otpEmail || user.otpExpires < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired Email OTP" });
    }

    // ✅ Success - Update verification status
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    user.phoneOtp = undefined;
    user.phoneOtpExpires = undefined;
    await user.save();

    // Also update legacy User collection for sync
    await User.findOneAndUpdate(
      { email },
      { isVerified: true, otp: undefined, otpExpires: undefined, phoneOtp: undefined, phoneOtpExpires: undefined }
    );

    res.status(200).json({ message: "Account verified successfully! You can now login." });

  } catch (err) {
    console.error("Verification Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// =================================================
// 3️⃣ LOGIN USER - STEP 1 (Credentials -> 2FA) - UPDATED FOR SEPARATED DATA
// =================================================
export const loginUser = async (req, res) => {
  try {
    const { id, password, role } = req.body;
    const safeId = id.toString().trim().toUpperCase();
    const userRole = role ? role.toLowerCase().trim() : null;

    // Find user based on role or search all collections
    let user = null;
    let isStudent = false;

    if (userRole === "student") {
      user = await StudentUser.findOne({ id: safeId });
      isStudent = true;
    } else if (userRole === "staff" || userRole === "admin") {
      user = await StaffUser.findOne({ id: safeId });
      isStudent = false;
    } else {
      // Role not specified, search both collections
      user = await StudentUser.findOne({ id: safeId });
      if (user) {
        isStudent = true;
      } else {
        user = await StaffUser.findOne({ id: safeId });
        isStudent = false;
      }
    }

    // Fallback to legacy User collection
    if (!user) {
      user = await User.findOne({ id: safeId });
    }

    if (!user) return res.status(400).json({ message: "User not found" });

    if (!user.isVerified) return res.status(403).json({ message: "Account not verified" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid password" });

    // Generate Token with appropriate role info
    const tokenPayload = {
      id: user.id,
      role: isStudent ? "student" : (user.role || "staff"),
      isDeptAdmin: user.isDeptAdmin || false,
      adminDepartment: user.adminDepartment || "",
      isMasterAdmin: user.isMasterAdmin || false
    };

    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || "fallback_secret_key_123",
      { expiresIn: "7d" }
    );

    // Response Data
    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        role: isStudent ? "student" : (user.role || "staff"),
        fullName: user.fullName,
        isDeptAdmin: user.isDeptAdmin || false,
        adminDepartment: user.adminDepartment || "",
        isMasterAdmin: user.isMasterAdmin || false,
        program: user.program || "",
        department: user.staffDepartment || user.adminDepartment || ""
      },
    });

  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// =================================================
// 4️⃣ LOGIN USER - STEP 2 (Verify OTP -> Token) - UPDATED FOR SEPARATED DATA
// =================================================
export const verifyLogin = async (req, res) => {
  try {
    const { id, otp, role } = req.body;
    const safeId = id.toString().trim().toUpperCase();
    const userRole = role ? role.toLowerCase().trim() : null;

    // Find user based on role or search all collections
    let user = null;
    let isStudent = false;

    if (userRole === "student") {
      user = await StudentUser.findOne({ id: safeId });
      isStudent = true;
    } else if (userRole === "staff" || userRole === "admin") {
      user = await StaffUser.findOne({ id: safeId });
      isStudent = false;
    } else {
      // Role not specified, search both collections
      user = await StudentUser.findOne({ id: safeId });
      if (user) {
        isStudent = true;
      } else {
        user = await StaffUser.findOne({ id: safeId });
        isStudent = false;
      }
    }

    // Fallback to legacy User collection
    if (!user) {
      user = await User.findOne({ id: safeId });
    }

    if (!user) return res.status(400).json({ message: "User not found" });

    if (user.otp !== otp || user.otpExpires < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired Login OTP" });
    }

    // Clear OTP
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    // Generate Token with appropriate role info
    const tokenPayload = {
      id: user.id,
      role: isStudent ? "student" : (user.role || "staff"),
      isDeptAdmin: user.isDeptAdmin || false,
      adminDepartment: user.adminDepartment || "",
      isMasterAdmin: user.isMasterAdmin || false
    };

    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || "fallback_secret_key_123",
      { expiresIn: "7d" }
    );

    // Response Data
    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        role: isStudent ? "student" : (user.role || "staff"),
        fullName: user.fullName,
        isDeptAdmin: user.isDeptAdmin || false,
        adminDepartment: user.adminDepartment || "",
        isMasterAdmin: user.isMasterAdmin || false,
        program: user.program || "",
        department: user.staffDepartment || user.adminDepartment || ""
      },
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =================================================
// 5️⃣ FORGOT PASSWORD (ID + Phone -> SMS OTP) - UPDATED FOR SEPARATED DATA
// =================================================
export const forgotPassword = async (req, res) => {
  try {
    const { id, phone } = req.body;
    const safeId = id.toString().trim().toUpperCase();
    const safePhone = phone.toString().trim();

    // Find user in StudentUser or StaffUser
    let user = await StudentUser.findOne({ id: safeId, phone: safePhone });
    if (!user) {
      user = await StaffUser.findOne({ id: safeId, phone: safePhone });
    }
    // Fallback to legacy User
    if (!user) {
      user = await User.findOne({ id: safeId, phone: safePhone });
    }

    if (!user) {
      return res.status(404).json({ message: "No user found with this ID and Phone combination." });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash OTP before storing
    const hashedOtp = await bcrypt.hash(otp, 10);

    user.resetOtp = hashedOtp;
    user.resetOtpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    // 🔐 Log OTP prominently in terminal
    if (global.logOTP) global.logOTP("PASSWORD RESET", safePhone, otp);

    // Send SMS
    await sendSms(safePhone, otp);

    res.json({ message: `Password reset OTP sent to ${safePhone}` });

  } catch (err) {
    console.error("Forgot Password Error:", err);
    res.status(500).json({ message: "Failed to send OTP" });
  }
};

// =================================================
// 6️⃣ RESET PASSWORD (Verify OTP -> New Password) - UPDATED FOR SEPARATED DATA
// =================================================
export const resetPassword = async (req, res) => {
  try {
    const { id, otp, newPassword } = req.body;
    const safeId = id.toString().trim().toUpperCase();

    // Find user in StudentUser or StaffUser with valid OTP
    let user = await StudentUser.findOne({
      id: safeId,
      resetOtpExpires: { $gt: Date.now() }
    });

    if (!user) {
      user = await StaffUser.findOne({
        id: safeId,
        resetOtpExpires: { $gt: Date.now() }
      });
    }

    // Fallback to legacy User
    if (!user) {
      user = await User.findOne({
        id: safeId,
        resetOtpExpires: { $gt: Date.now() }
      });
    }

    if (!user) {
      return res.status(400).json({ message: "OTP expired or invalid user." });
    }

    const isOtpValid = await bcrypt.compare(otp, user.resetOtp);
    if (!isOtpValid) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // Update password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetOtp = undefined;
    user.resetOtpExpires = undefined;
    await user.save();

    // Also update in legacy User collection
    await User.findOneAndUpdate(
      { id: safeId },
      { password: hashedPassword, resetOtp: undefined, resetOtpExpires: undefined }
    );

    res.json({ message: "✅ Password reset successfully. You can now login." });

  } catch (err) {
    console.error("Reset Password Error:", err);
    res.status(500).json({ message: "Password reset failed" });
  }
};
