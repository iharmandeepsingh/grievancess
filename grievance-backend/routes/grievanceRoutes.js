console.log("✅ grievanceRoutes loaded");

import express from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import Grievance from "../models/GrievanceModel.js";

import {
  submitGrievance,
  getAllGrievances,
  getCategoryGrievances,
  assignToStaff,
  getAssignedGrievances,
  updateGrievanceStatus,
  requestExtension,
  resolveExtension,
  verifyResolution,
  hideGrievance,
  getPoolAcceptGrievances,
  acceptGrievance,
  getGrievanceDetail
} from "../controllers/grievanceController.js";

const router = express.Router();

/* ================= STUDENT ================= */

// ✅ Student submits grievance
router.post("/submit", submitGrievance);

// ✅ Student grievance history
router.get("/user/:userId", getCategoryGrievances); // Reuse for user grievances

/* ================= MASTER ADMIN ================= */

router.get("/all", getAllGrievances);

/* ================= CATEGORY ADMIN ================= */

router.get("/category/:category", getCategoryGrievances);
router.get("/department/:department", getCategoryGrievances); // Reuse for department grievances
router.put("/assign/:id", assignToStaff);

/* ================= STAFF ================= */

router.get("/assigned/:staffId", getAssignedGrievances);

/* ================= UPDATE (STAFF / ADMIN) ================= */

router.put("/update/:id", updateGrievanceStatus);

/* ================= EXTENSION ================= */

router.post("/extension/request/:id", requestExtension);
router.post("/extension/resolve/:id", resolveExtension);

/* ================= ⭐ RATING ================= */

router.post("/rate/:id", verifyToken, async (req, res) => {
  try {
    const { stars, feedback } = req.body;
    const grievanceId = req.params.id;

    if (stars < 1 || stars > 5) {
      return res.status(400).json({ message: "Invalid rating" });
    }

    const grievance = await Grievance.findById(grievanceId);
    if (!grievance) {
      return res.status(404).json({ message: "Grievance not found" });
    }

    // ✅ Only grievance owner
    if (grievance.userId.toUpperCase() !== req.user.id.toUpperCase()) {
      return res.status(403).json({ message: "You cannot rate this grievance" });
    }

    // ✅ Only resolved
    if (grievance.status !== "Resolved") {
      return res.status(400).json({ message: "Grievance not resolved yet" });
    }

    // ✅ Prevent re-rating
    if (grievance.isRated) {
      return res.status(400).json({ message: "Already rated" });
    }

    grievance.rating = {
      stars,
      feedback,
      ratedAt: new Date()
    };
    grievance.isRated = true;

    await grievance.save();
    res.json({ message: "✅ Rating submitted successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Rating failed" });
  }
});

/* ================= ✅ VERIFICATION (FINAL & SAFE) ================= */

router.post("/verify-resolution/:id", async (req, res) => {
  try {
    const { action } = req.body;
    const grievanceId = req.params.id;

    console.log("👉 VERIFY API HIT");
    console.log("👉 ACTION:", action);
    console.log("👉 ID:", grievanceId);

    const grievance = await Grievance.findById(grievanceId);
    if (!grievance) {
      console.log("❌ Grievance not found");
      return res.status(404).json({ message: "Grievance not found" });
    }

    console.log("👉 CURRENT STATUS IN DB:", grievance.status);

    // FORCE UPDATE (no conditions yet)
    grievance.status = "Resolved";
    grievance.autoClosed = false;

    await grievance.save();

    console.log("✅ UPDATED STATUS IN DB:", grievance.status);

    return res.json({
      message: "Grievance force-closed for testing",
      grievance
    });

  } catch (err) {
    console.error("❌ Verify resolution error:", err);
    res.status(500).json({ message: "Verification failed" });
  }
});

/* ================= 🆕 POOL ACCEPT MODE ================= */

router.get("/pool-accept", getPoolAcceptGrievances);
router.post("/accept/:grievanceId", acceptGrievance);

/* ================= GRIEVANCE DETAIL ================= */

router.get("/detail/:grievanceId", getGrievanceDetail);

export default router;
