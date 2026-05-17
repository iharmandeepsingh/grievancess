import express from "express";
import User from "../models/UserModel.js";
import {
  registerRequest,
  verifyRegistration,
  loginUser,
  verifyLogin,
  forgotPassword,
  resetPassword
} from "../controllers/authController.js";

const router = express.Router();

// Register (Step 1 & 2)
router.post("/register-request", registerRequest);
router.post("/verify-registration", verifyRegistration);

// Login (Step 1 & 2)
router.post("/login", loginUser);
router.post("/verify-login", verifyLogin);

// Forgot Password (ID + Email -> Email OTP)
router.post("/forgot-password", forgotPassword);

// Reset Password
router.post("/reset-password", resetPassword);

// Get User by ID
router.get("/user/:id", async (req, res) => {
  try {
    const safeId = req.params.id.toString().trim().toUpperCase();
    console.log(`🔍 Fetching user with ID: ${safeId}`);
    
    let user = await User.findOne({ id: safeId });
    console.log(`👤 User found: ${user ? 'YES' : 'NO'}`);

    if (!user) {
      // If user doesn't exist, try to create a basic profile
      console.log(`👤 User not found, attempting to create basic profile for ID: ${safeId}`);
      
      // Check if this is a student ID pattern (all numbers)
      const isStudent = /^\d+$/.test(safeId);
      
      // Create a basic user profile with minimal data
      user = new User({
        id: safeId,
        role: isStudent ? "student" : "staff",
        fullName: "Student", // Default name
        email: `${safeId}@ctuniversity.edu`, // Default email
        phone: "",
        password: "default_password_change_me", // Default password - should be changed
        isVerified: true,
        program: isStudent ? "B.Tech" : "", // Default program for students
        adminDepartment: isStudent ? "" : "General"
      });
      
      await user.save();
      console.log(`👤 Created basic user profile for ID: ${safeId}`);
    }

    // 🔥 LOGIC FIX:
    // Agar Student hai -> toh 'program' bhejo
    // Agar Staff hai -> toh 'staffDepartment' ya 'adminDepartment' bhejo
    let deptToSend = "";

    if (user.role === "student") {
      deptToSend = user.program;
    } else {
      deptToSend = user.staffDepartment || user.adminDepartment;
    }

    res.json({
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      // Frontend ko ab hamesha 'department' milega
      department: deptToSend || "General"
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});

export default router;
