import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Send Promotion Email
export const sendPromotionEmail = async (staffEmail, staffName, newRole, department, staffId) => {
  try {
    const promotionDate = new Date().toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata"
    });

    const emailSubject = `🎉 Promotion Notification - ${newRole} Role`;
    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Congratulations!</h2>
        <p>Dear ${staffName},</p>
        <p>You have been promoted to <strong>${newRole}</strong> for the <strong>${department}</strong> department.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        
        <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0; font-weight: bold;">📋 Promotion Details:</p>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li><strong>Role:</strong> ${newRole}</li>
            <li><strong>Department:</strong> ${department}</li>
            <li><strong>Date & Time:</strong> ${promotionDate}</li>
            <li><strong>Staff ID:</strong> ${staffId}</li>
          </ul>
        </div>

        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
          <p style="margin: 0; color: #92400e;"><strong>⚠️ Important:</strong> You may need to logout and login again to see your new dashboard and permissions.</p>
        </div>

        <p>If you have any questions, please contact your administrator.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #64748b; font-size: 0.9rem;">Best regards,<br><strong>Grievance Portal Team</strong></p>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: staffEmail,
      subject: emailSubject,
      html: emailBody
    });

    console.log(`✅ Promotion email sent to ${staffEmail}`);
    return { success: true, message: "Email sent successfully" };
  } catch (error) {
    console.error("⚠️ Email sending failed:", error);
    return { success: false, message: "Email could not be sent" };
  }
};

// Send OTP Email
export const sendEmailOtp = async (email, otp) => {
  try {
    const emailSubject = `🔐 Your Registration OTP - Grievance Portal`;
    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #2563eb; padding: 20px; text-align: center;">
          <h2 style="color: white; margin: 0;">Grievance Portal</h2>
        </div>
        <div style="padding: 20px;">
          <p>Dear User,</p>
          <p>Your One-Time Password (OTP) for registration is:</p>
          <div style="background-color: #f3f4f6; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <h1 style="color: #1e40af; letter-spacing: 5px; margin: 0;">${otp}</h1>
          </div>
          <p>This OTP is valid for 10 minutes. Please do not share it with anyone.</p>
          <p>If you did not request this, please ignore this email.</p>
        </div>
        <div style="background-color: #f8fafc; padding: 15px; text-align: center; color: #64748b; font-size: 0.875rem;">
          <p style="margin: 0;">&copy; ${new Date().getFullYear()} CT University Grievance Portal. All rights reserved.</p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: emailSubject,
      html: emailBody
    });

    console.log(`✅ OTP email sent to ${email}`);
    return { success: true, message: "OTP sent successfully" };
  } catch (error) {
    console.error("⚠️ OTP Email sending failed:", error);
    return { success: false, message: "OTP Email could not be sent" };
  }
};

export default transporter;
