import Grievance from "../models/GrievanceModel.js";
import User from "../models/UserModel.js";
import nodemailer from "nodemailer";
import { autoAssignGrievance } from "./routingRuleController.js";

/* =====================================================
   1️⃣ STUDENT → SUBMIT GRIEVANCE
   → Goes to CATEGORY inbox (UNASSIGNED)
   → OR Auto-assigns if routing rule exists
===================================================== */
export const submitGrievance = async (req, res) => {
  try {
    const {
      userId,
      name,
      email,
      phone,
      regid,
      studentProgram,   // ✅ required
      category,         // ✅ ONLY routing key
      message,
      attachment,       // ✅ Extract attachment from JSON body
      issueTypeId,      // ✅ NEW: Issue type for auto-assignment
    } = req.body;

    // 🔒 Safety validation
    if (!studentProgram || !category) {
      return res.status(400).json({
        message: "Student program or category missing",
      });
    }

    // 🔥 SMART AUTO-ASSIGNMENT CHECK
    let assignedStaff = null;
    let assignmentMode = "manual";
    
    if (issueTypeId) {
      const autoAssignment = await autoAssignGrievance(issueTypeId, category);
      if (autoAssignment) {
        assignedStaff = autoAssignment;
        assignmentMode = autoAssignment.assignmentMode;
        console.log(`🤖 Auto-assigned grievance to ${assignedStaff.staffName} (${assignmentMode} mode)`);
      }
    }

    const grievance = await Grievance.create({
      userId,
      name,
      email,
      phone,
      regid,

      studentProgram,
      category,
      message,

      attachment: attachment || "", // ✅ Save the filename string

      issueTypeId: issueTypeId || null,
      assignmentMode: assignmentMode,

      // Assignment fields
      assignedTo: assignedStaff ? assignedStaff.staffId : null,
      assignedRole: assignedStaff ? "staff" : null,
      assignedBy: assignedStaff ? "SYSTEM_AUTO" : null,
      deadlineDate: assignedStaff ? calculateDeadline() : null,

      status: assignedStaff ? "Assigned" : "Pending",
    });

    // 📧 Send email notification if auto-assigned
    if (assignedStaff) {
      try {
        await sendAssignmentNotification(grievance, assignedStaff.staffName);
      } catch (emailError) {
        console.error("Email notification failed (non-blocking):", emailError.message);
        // Continue without failing the submission
      }
    }

    res.status(201).json({
      message: assignedStaff 
        ? "✅ Grievance submitted and auto-assigned successfully"
        : "✅ Grievance submitted successfully",
      grievance,
      autoAssigned: !!assignedStaff,
    });

  } catch (err) {
    console.error("Submit Error Details:", err);
    console.error("Error Stack:", err.stack);
    res.status(500).json({
      message: "Failed to submit grievance",
      error: err.message || "Unknown error"
    });
  }
};

// Helper: Calculate default deadline (7 days from now)
function calculateDeadline() {
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 7);
  return deadline;
}

// Helper: Send assignment notification email
async function sendAssignmentNotification(grievance, staffName) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: grievance.email,
      subject: `🎯 New Grievance Auto-Assigned - ${grievance.category}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">New Grievance Auto-Assigned</h2>
          <p>Dear ${staffName},</p>
          <p>A new grievance has been automatically assigned to you:</p>
          <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Category:</strong> ${grievance.category}</p>
            <p><strong>Student:</strong> ${grievance.name} (${grievance.userId})</p>
            <p><strong>Message:</strong> ${grievance.message}</p>
            <p><strong>Deadline:</strong> ${grievance.deadlineDate ? new Date(grievance.deadlineDate).toLocaleDateString() : 'N/A'}</p>
          </div>
          <p>Please log in to the portal to view and process this grievance.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #64748b; font-size: 0.9rem;">Best regards,<br><strong>Grievance Portal Team</strong></p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Assignment notification sent to ${staffName}`);
  } catch (error) {
    console.error("⚠️ Failed to send assignment notification:", error);
  }
}

/* =====================================================
   🆕 POOL ACCEPT MODE: Get grievances available for acceptance
===================================================== */
export const getPoolAcceptGrievances = async (req, res) => {
  try {
    const { staffId, department } = req.query;
    
    // Find all routing rules with pool_accept mode for this department
    const RoutingRule = (await import("../models/RoutingRule.js")).default;
    const routingRules = await RoutingRule.find({
      department,
      assignmentMode: "pool_accept",
      isActive: true
    }).populate('issueTypeId');

    if (routingRules.length === 0) {
      return res.json([]);
    }

    // Get all issue type IDs from routing rules
    const issueTypeIds = routingRules.map(r => r.issueTypeId._id);

    // Find grievances with these issue types that are still Pending
    const grievances = await Grievance.find({
      issueTypeId: { $in: issueTypeIds },
      status: "Pending",
      assignmentMode: "pool_accept"
    }).sort({ createdAt: -1 });

    res.json(grievances);
  } catch (err) {
    console.error("Error fetching pool accept grievances:", err);
    res.status(500).json({ message: "Failed to fetch pool accept grievances" });
  }
};

/* =====================================================
   🆕 POOL ACCEPT MODE: Staff accepts grievance
===================================================== */
export const acceptGrievance = async (req, res) => {
  try {
    const { grievanceId } = req.params;
    const { staffId, staffName } = req.body;

    const grievance = await Grievance.findById(grievanceId);
    if (!grievance) {
      return res.status(404).json({ message: "Grievance not found" });
    }

    // Check if grievance is still available for acceptance
    if (grievance.status !== "Pending" || grievance.assignmentMode !== "pool_accept") {
      return res.status(400).json({ message: "Grievance is not available for acceptance" });
    }

    // Assign to staff
    grievance.assignedTo = staffId;
    grievance.assignedRole = "staff";
    grievance.assignedBy = "STAFF_ACCEPT";
    grievance.status = "Assigned";
    grievance.deadlineDate = calculateDeadline();

    await grievance.save();

    // Update staff pool load
    const StaffPool = (await import("../models/StaffPool.js")).default;
    await StaffPool.findOneAndUpdate(
      { staffId },
      { $inc: { currentLoad: 1 } }
    );

    res.json({ message: "Grievance accepted successfully", grievance });
  } catch (err) {
    console.error("Error accepting grievance:", err);
    res.status(500).json({ message: "Failed to accept grievance" });
  }
};


/* =====================================================
   2️⃣ MASTER ADMIN → SEE ALL GRIEVANCES
===================================================== */
export const getAllGrievances = async (req, res) => {
  try {
    // 🔍 Filter: Don't show if user has "soft deleted" it
    const userId = req.user ? req.user.id : null;
    const query = userId ? { hiddenFor: { $ne: userId } } : {};

    const grievances = await Grievance.find(query).sort({ createdAt: -1 });
    res.json(grievances);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch grievances" });
  }
};


/* =====================================================
   3️⃣ CATEGORY ADMIN → VIEW THEIR CATEGORY'S GRIEVANCES
   → Only grievances of THEIR category
===================================================== */
export const getCategoryGrievances = async (req, res) => {
  try {
    // Check for category in params (for /category/:category) or query (for /department/:department?category=)
    const category = req.params.category 
      ? decodeURIComponent(req.params.category).trim()
      : (req.query.category ? decodeURIComponent(req.query.category).trim() : null);
    
    const userId = req.user ? req.user.id : null;

    const grievances = await Grievance.find({
      category,
      hiddenFor: { $ne: userId } // 🔍 Filter hidden
    }).sort({ createdAt: -1 });

    res.json(grievances);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch category grievances" });
  }
};


/* =====================================================
   4️⃣ CATEGORY ADMIN → ASSIGN TO STAFF (5-digit)
===================================================== */
export const assignToStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { staffId, adminId, deadline } = req.body;

    // Debug: log incoming assign payload
    // console.log(`Assign request for grievance ${id} -> staff: ${staffId}, admin: ${adminId}, deadline: ${deadline}`);

    // ✅ Prevent assigning to self (submitter)
    const existingGrievance = await Grievance.findById(id);
    if (!existingGrievance) return res.status(404).json({ message: "Grievance not found" });

    if (existingGrievance.userId === staffId) {
      return res.status(400).json({ message: "❌ Cannot assign grievance to the staff member who submitted it." });
    }

    // Validate deadline (if provided) must not be before grievance creation date.
    // Compare only by calendar date (ignore time) so a deadline on the same day is allowed.
    let deadlineDate = null;
    if (deadline) {
      const parsed = new Date(deadline);
      if (isNaN(parsed.getTime())) {
        return res.status(400).json({ message: "Invalid deadline date" });
      }

      // Compare date-only values to allow same-day deadlines.
      const parsedDateOnly = new Date(parsed.toISOString().slice(0, 10));
      const createdDateOnly = new Date(existingGrievance.createdAt.toISOString().slice(0, 10));

      if (parsedDateOnly < createdDateOnly) {
        // return res.status(400).json({ message: "Deadline cannot be earlier than grievance creation date" });
        console.warn("⚠️ Warning: Deadline is earlier than grievance creation date (Allowed for Admin override)");
      }

      // Keep the original parsed value (preserve any time if provided)
      deadlineDate = parsed;
    }

    const update = {
      assignedTo: staffId,
      assignedRole: "staff",
      assignedBy: adminId,
      status: "Assigned",
      updatedAt: Date.now(),
    };

    if (deadlineDate) update.deadlineDate = deadlineDate;

    // Debug: log the update object that will be applied
    // console.log('Assign update object:', update);

    const grievance = await Grievance.findByIdAndUpdate(id, update, { new: true });

    // console.log('Assign result (saved grievance):', grievance);

    res.json({
      message: "✅ Assigned to staff successfully",
      grievance,
    });
  } catch (err) {
    console.error("Assign Error:", err);
    res.status(500).json({ message: "Assignment failed" });
  }
};


/* =====================================================
   5️⃣ STAFF → SEE ONLY ASSIGNED GRIEVANCES
===================================================== */
export const getAssignedGrievances = async (req, res) => {
  try {
    const { staffId } = req.params;

    // Return only fields required by the UI to reduce response size and speed the query
    const userId = req.user?.id;
    const hiddenFilter = userId ? { hiddenFor: { $ne: userId } } : {};

    const grievances = await Grievance.find({
      assignedTo: staffId,
      ...hiddenFilter
    })
      .select('name email regid message createdAt deadlineDate extensionRequest status attachment _id assignedTo updatedAt')
      .sort({ createdAt: -1 });

    // console.log(`getAssignedGrievances: returning ${grievances.length} grievances for staff ${staffId}`);
    res.json(grievances);
  } catch (err) {
    console.error("getAssignedGrievances ERROR:", err);
    res.status(500).json({ message: "Failed to fetch assigned grievances" });
  }
};


/* =====================================================
   6️⃣ STUDENT → OWN GRIEVANCE HISTORY
===================================================== */
export const getUserGrievances = async (req, res) => {
  try {
    const { userId } = req.params;

    // Ensure users can only see their own (controller is reusable though) or admin sees user's history
    // We already filter by userId, just add the hidden check for the REQUESTER
    const requesterId = req.user ? req.user.id : null;

    const grievances = await Grievance.find({
      userId,
      hiddenFor: { $ne: requesterId } // 🔍 Filter hidden
    }).sort({ createdAt: -1 });

    res.json(grievances);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch user grievances" });
  }
};


// ✅ 7️⃣ STAFF / ADMIN → UPDATE STATUS (With Verification Logic)
export const updateGrievanceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolutionRemarks, resolvedBy } = req.body;

    // 🔥 If status is "Resolved", switch to "Verification"
    let finalStatus = status;
    let resolutionTime = null;

    if (status === "Resolved") {
      finalStatus = "Verification";
      resolutionTime = Date.now();
    }

    const updateData = {
      status: finalStatus,
      resolutionRemarks,
      resolvedBy,
      updatedAt: Date.now(),
    };

    if (resolutionTime) {
      updateData.resolutionProposedAt = resolutionTime;
    }

    const grievance = await Grievance.findByIdAndUpdate(id, updateData, { new: true });

    // 📧 SEND EMAIL IF STATUS IS VERIFICATION
    if (finalStatus === "Verification") {
      try {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        const html = `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e2e8f0; max-width: 600px;">
            <h2 style="color: #fca5a5;">Action Required: Verify Resolution</h2>
            <p>Dear <strong>${grievance.name}</strong>,</p>
            <p>The staff has proposed a resolution for your grievance related to <strong>${grievance.category}</strong>.</p>
            <div style="background: #fff1f2; padding: 15px; border-left: 4px solid #f43f5e; margin: 20px 0;">
              <strong>Staff Remarks:</strong> ${resolutionRemarks}
            </div>
            <p>Please login to your dashboard to <strong>Accept</strong> or <strong>Reject</strong> this resolution within <strong>36 hours</strong>.</p>
            <p style="color: #64748b; font-size: 0.9rem;">If no action is taken, it will be automatically marked as Resolved.</p>
          </div>
        `;

        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: grievance.email,
          subject: "Action Required: Verify Grievance Resolution",
          html
        });
        console.log(`✅ Verification email sent to student ${grievance.email}`);
      } catch (err) {
        console.error("⚠️ Email failed:", err);
      }
    }

    res.json({
      message: status === "Resolved" ? "✅ Resolution submitted for verification" : "✅ Status updated",
      grievance,
    });
  } catch (err) {
    res.status(500).json({ message: "Update failed" });
  }
};


// 🆕 ✅ VERIFY RESOLUTION (Student Action)
export const verifyResolution = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, feedback } = req.body; // 'accept' | 'reject'

    const grievance = await Grievance.findById(id);
    if (!grievance) return res.status(404).json({ message: "Grievance not found" });

    let newStatus = "";
    let emailSubject = "";
    let emailBody = "";
    let notifyEmails = [];

    // Find assigned staff email
    let staffEmail = null;
    let deptAdminEmail = null;

    if (grievance.assignedTo) {
      const staff = await User.findOne({ id: grievance.assignedTo });
      if (staff) staffEmail = staff.email;
    }

    // If Rejected, we also need Dept Admin email (Assigned By usually is Admin)
    if (action === "reject" && grievance.assignedBy) {
      const admin = await User.findOne({ id: grievance.assignedBy });
      if (admin) deptAdminEmail = admin.email;
    }

    if (action === "accept") {
      newStatus = "Resolved";
      emailSubject = "Resolution Accepted ✅";
      emailBody = `The student has <strong>ACCEPTED</strong> the resolution for grievance #${id}. Great job!`;
      if (staffEmail) notifyEmails.push(staffEmail);
    } else {
      newStatus = "Pending"; // Reopen
      emailSubject = "Resolution Rejected ❌";
      emailBody = `The student has <strong>REJECTED</strong> the resolution for grievance #${id}.<br><br><strong>Student Feedback:</strong> ${feedback}<br><br>Please review and take necessary action immediately.`;
      if (staffEmail) notifyEmails.push(staffEmail);
      if (deptAdminEmail && deptAdminEmail !== staffEmail) notifyEmails.push(deptAdminEmail);
    }

    // Update Status
    grievance.status = newStatus;
    // grievance.resolutionRemarks += `\n[Student Verified: ${action.toUpperCase()} - ${feedback || "No feedback"}]`; 
    // Optional: Append feedback to internal remarks if desired, keeping simple for now.

    await grievance.save();

    // 📧 SEND EMAILS
    if (notifyEmails.length > 0) {
      try {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
        });

        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: notifyEmails, // Array of emails
          subject: `${emailSubject} - Grievance #${id}`,
          html: `<p>${emailBody}</p>`
        });
        console.log(`✅ Verification outcome email sent to: ${notifyEmails.join(", ")}`);
      } catch (err) {
        console.error("⚠️ Failed to send verification outcome email:", err);
      }
    }

    res.json({ message: `Grievance marked as ${newStatus}`, grievance });

  } catch (err) {
    console.error("Verification Error:", err);
    res.status(500).json({ message: "Verification failed" });
  }
};

// ... (Existing Routes Below) //

// ✅ Request Extension (Staff)
export const requestExtension = async (req, res) => {
  try {
    const { id } = req.params;
    const { requestedDate, reason } = req.body;

    const grievance = await Grievance.findByIdAndUpdate(
      id,
      {
        extensionRequest: {
          requestedDate: new Date(requestedDate),
          reason,
          status: "Pending"
        }
      },
      { new: true }
    );

    res.json({ message: "Extension requested successfully", grievance });
  } catch (err) {
    res.status(500).json({ message: "Request failed" });
  }
};

// ✅ Resolve Extension (Admin)
// ✅ Resolve Extension (Admin)
export const resolveExtension = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'approve' or 'reject'

    const grievance = await Grievance.findById(id);
    if (!grievance) return res.status(404).json({ message: "Grievance not found" });

    if (action === 'approve') {
      grievance.deadlineDate = grievance.extensionRequest.requestedDate;
      grievance.extensionRequest.status = "Approved";
    } else {
      grievance.extensionRequest.status = "Rejected"; // Keep record of rejection
    }

    await grievance.save();

    // 📧 SEND EMAIL NOTIFICATION TO STAFF
    try {
      if (grievance.assignedTo) {
        const staff = await User.findOne({ id: grievance.assignedTo });

        if (staff && staff.email) {
          const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
              user: process.env.EMAIL_USER,
              pass: process.env.EMAIL_PASS,
            },
          });

          const isApproved = action === 'approve';
          const subject = isApproved ? "Extension Request Approved ✅" : "Extension Request Rejected ❌";
          const color = isApproved ? "#16a34a" : "#dc2626";
          const message = isApproved
            ? `Good news! Your request to extend the deadline for grievance <strong>#${grievance._id}</strong> has been approved. The new deadline is now <strong>${new Date(grievance.deadlineDate).toDateString()}</strong>.`
            : `Your request to extend the deadline for grievance <strong>#${grievance._id}</strong> has been rejected. The original deadline remains unchanged.`;

          const html = `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; max-width: 600px;">
              <h2 style="color: ${color}; margin-top: 0;">${subject}</h2>
              <p style="color: #334155; font-size: 16px;">Dear <strong>${staff.fullName}</strong>,</p>
              <p style="color: #475569; line-height: 1.6;">${message}</p>
              
              <div style="background: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid ${color};">
                <p style="margin: 5px 0;"><strong>Extension Reason:</strong> ${grievance.extensionRequest.reason}</p>
                ${isApproved ? `<p style="margin: 5px 0;"><strong>New Deadline:</strong> ${new Date(grievance.deadlineDate).toDateString()}</p>` : ''}
              </div>

              <p style="color: #94a3b8; font-size: 14px;">Please login to the portal to view more details.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="color: #cbd5e1; font-size: 12px; text-align: center;">CTU Grievance Portal Notification System</p>
            </div>
          `;

          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: staff.email,
            subject: `${subject} - CTU Grievance Portal`,
            html: html
          });

          console.log(`✅ Extension notification email sent to ${staff.email} (${action})`);
        }
      }
    } catch (emailErr) {
      console.error("⚠️ Failed to send extension notification email:", emailErr);
      // Don't fail the request just because email failed
    }

    res.json({ message: `Extension ${action}d successfully`, grievance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Action failed" });
  }
};

// ✅ Get Grievance Details with Assigned Staff Info
export const getGrievanceDetail = async (req, res) => {
  try {
    const { grievanceId } = req.params;

    const grievance = await Grievance.findById(grievanceId);
    if (!grievance) {
      return res.status(404).json({ error: "Grievance not found" });
    }

    // Fetch assigned staff details if available
    let staffInfo = null;
    if (grievance.assignedTo) {
      // Import User model dynamically to avoid circular dependency
      const { default: User } = await import("../models/UserModel.js");
      const staff = await User.findOne({ id: grievance.assignedTo });
      if (staff) {
        staffInfo = {
          id: staff.id,
          name: staff.fullName || staff.name || grievance.assignedTo,
          department: grievance.category
        };
      }
    }

    res.json({
      name: grievance.name,
      message: grievance.message,
      regid: grievance.regid,
      category: grievance.category,
      assignedStaff: staffInfo,
      createdAt: grievance.createdAt,
      deadlineDate: grievance.deadlineDate || null
    });
  } catch (err) {
    console.error("Error fetching grievance details:", err);
    res.status(500).json({ error: "Failed to fetch grievance details" });
  }
};

// ✅ Hide Grievance (Soft Delete)
export const hideGrievance = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id; // From verifyToken

    await Grievance.findByIdAndUpdate(id, {
      $addToSet: { hiddenFor: userId }
    });

    res.json({ message: "Grievance hidden successfully" });
  } catch (err) {
    console.error("Hide Error:", err);
    res.status(500).json({ message: "Failed to hide grievance" });
  }
};
