import mongoose from "mongoose";


const grievanceSchema = new mongoose.Schema(
  {
    // ================= STUDENT INFO =================
    userId: { type: String, required: true }, // 8-digit Student ID
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    regid: { type: String },

    // ================= STUDENT ACADEMIC =================
    studentProgram: {
      type: String,
      required: true // e.g. B.Tech CSE
    },
    rating: {
      stars: { type: Number, min: 1, max: 5 },
      feedback: { type: String },
      ratedAt: { type: Date },
    },
    isRated: {
      type: Boolean,
      default: false
    }
    ,

    // ================= GRIEVANCE ROUTING (CATEGORY + ISSUE TYPE) =================
    category: {
      type: String,
      required: true,
      enum: [
        "Accounts",
        "Student Welfare",
        "Student Section",
        "Admission",
        "Examination",
        "School of Engineering and Technology",
        "School of Management Studies",
        "School of Law",
        "School of Pharmaceutical Sciences",
        "School of Hotel Management",
        "School of Design and innovation",
        "School of Allied Health Sciences",
        "School of Social Sciences and Liberal Arts",
        "HR",
        "CRC (Placement)",
        "Transport"
      ]
    },
    issueTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "IssueType",
      default: null
    },
    assignmentMode: {
      type: String,
      enum: ["manual", "single", "round_robin", "pool_accept"],
      default: "manual"
    },
    verificationAttempts: {
      type: Number,
      default: 0
    },
    autoClosed: {
      type: Boolean,
      default: false
    }
    ,

    // ================= CONTENT =================
    message: { type: String, required: true },
    attachment: { type: String, default: "" },

    // ================= ASSIGNMENT FLOW =================
    assignedTo: { type: String, default: null },
    assignedRole: {
      type: String,
      enum: ["staff", "admin"],
      default: null
    },
    assignedBy: { type: String, default: null },

    // ================= RESOLUTION =================
    resolvedBy: { type: String, default: null },
    resolutionRemarks: { type: String, default: "" },

    // ================= STATUS =================
    status: {
      type: String,
      enum: ["Pending", "Assigned", "In Progress", "Verification", "Resolved", "Rejected"],
      default: "Pending"
    },

    // ✅ Verification Logic
    resolutionProposedAt: { type: Date, default: null }, // Start of 36h timer

    // ✅ Deadline for assigned staff
    deadlineDate: { type: Date, default: null },

    // ================= EXTENSION REQUEST =================
    extensionRequest: {
      requestedDate: { type: Date, default: null },
      reason: { type: String, default: "" },
      status: {
        type: String,
        enum: ["None", "Pending", "Approved", "Rejected"],
        default: "None"
      }
    },

    // ================= VISIBILITY (SOFT DELETE) =================
    hiddenFor: {
      type: [String], // Array of User IDs who have "deleted" this grievance
      default: []
    }
  },
  { timestamps: true }
);

// Index to speed lookups for staff-assigned grievances
grievanceSchema.index({ assignedTo: 1, createdAt: -1 });

const Grievance =
  mongoose.models.Grievance ||
  mongoose.model("Grievance", grievanceSchema);


export default Grievance;
