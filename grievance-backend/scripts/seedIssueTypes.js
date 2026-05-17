import mongoose from "mongoose";
import IssueType from "../models/IssueType.js";
import Grievance from "../models/GrievanceModel.js";
import connectDB from "../config/db.js";

// Common issue types for each department based on typical student grievances
const departmentIssueTypes = {
  "Accounts": [
    { issueName: "Fee Payment Problem", description: "Issues with fee payment, payment gateway, or transaction failures" },
    { issueName: "Scholarship Disbursement", description: "Delays or issues with scholarship payments" },
    { issueName: "Refund Request", description: "Request for fee refunds or overpayment corrections" },
    { issueName: "Fee Receipt Issue", description: "Missing or incorrect fee receipts" },
    { issueName: "Hostel Fee Dispute", description: "Issues related to hostel fee charges" }
  ],
  "Admission": [
    { issueName: "Admission Form Issue", description: "Problems with filling or submitting admission forms" },
    { issueName: "Document Verification", description: "Issues with document verification process" },
    { issueName: "Seat Allotment", description: "Problems with seat allocation or branch change" },
    { issueName: "Admission Cancellation", description: "Requests for admission cancellation" },
    { issueName: "Migration Certificate", description: "Issues with obtaining migration certificates" }
  ],
  "Examination": [
    { issueName: "Exam Schedule Conflict", description: "Conflicts in examination timetable" },
    { issueName: "Hall Ticket Issue", description: "Problems with downloading or receiving hall tickets" },
    { issueName: "Result Revaluation", description: "Requests for paper revaluation" },
    { issueName: "Mark Sheet Issue", description: "Errors or missing marks in mark sheets" },
    { issueName: "Exam Fee Payment", description: "Issues with examination fee payments" }
  ],
  "Student Welfare": [
    { issueName: "Hostel Accommodation", description: "Issues with hostel room allocation or facilities" },
    { issueName: "Mess Food Quality", description: "Complaints about mess food quality or service" },
    { issueName: "Medical Services", description: "Issues with campus medical facilities" },
    { issueName: "Sports Facilities", description: "Problems with sports equipment or facilities" },
    { issueName: "Transportation", description: "Issues with campus transportation services" }
  ],
  "Transport": [
    { issueName: "Bus Route Change", description: "Request for change in bus route" },
    { issueName: "Bus Pass Issue", description: "Problems with bus pass issuance or renewal" },
    { issueName: "Bus Timing Issue", description: "Complaints about bus arrival/departure timings" },
    { issueName: "Bus Facility", description: "Issues with bus condition or maintenance" },
    { issueName: "Route Addition", description: "Request for new bus routes" }
  ],
  "HR": [
    { issueName: "Staff Grievance", description: "Issues related to staff welfare or concerns" },
    { issueName: "Leave Application", description: "Problems with leave approval process" },
    { issueName: "Salary Dispute", description: "Issues with salary payments or deductions" },
    { issueName: "Work Environment", description: "Concerns about workplace conditions" },
    { issueName: "Training Request", description: "Requests for training or skill development" }
  ],
  "Student Section": [
    { issueName: "ID Card Issue", description: "Problems with student ID card issuance" },
    { issueName: "Certificate Request", description: "Requests for various certificates (bonafide, TC, etc.)" },
    { issueName: "Attendance Issue", description: "Disputes related to attendance records" },
    { issueName: "Library Services", description: "Issues with library facilities or book availability" },
    { issueName: "Internet/WiFi", description: "Problems with campus internet connectivity" }
  ],
  "CRC": [
    { issueName: "Research Approval", description: "Issues with research project approvals" },
    { issueName: "Thesis Submission", description: "Problems with thesis submission process" },
    { issueName: "Publication Support", description: "Requests for publication support" },
    { issueName: "Conference Funding", description: "Issues with conference travel funding" },
    { issueName: "Lab Equipment", description: "Problems with research lab equipment" }
  ],
  "School": [
    { issueName: "Course Registration", description: "Issues with course registration process" },
    { issueName: "Class Schedule", description: "Problems with class timetable or scheduling" },
    { issueName: "Faculty Assignment", description: "Issues with assigned faculty or course instructors" },
    { issueName: "Credit Transfer", description: "Problems with credit transfer process" },
    { issueName: "Elective Selection", description: "Issues with elective course selection" }
  ]
};

async function seedIssueTypes() {
  try {
    await connectDB();
    console.log("✅ Connected to database");

    let totalCreated = 0;

    for (const [department, issueTypes] of Object.entries(departmentIssueTypes)) {
      console.log(`\n📋 Processing department: ${department}`);
      
      for (const issueType of issueTypes) {
        // Check if issue type already exists
        const existing = await IssueType.findOne({
          department,
          issueName: issueType.issueName
        });

        if (existing) {
          console.log(`  ⏭️  Skipping: ${issueType.issueName} (already exists)`);
          continue;
        }

        // Create new issue type
        const newIssueType = new IssueType({
          department,
          issueName: issueType.issueName,
          description: issueType.description,
          isActive: true
        });

        await newIssueType.save();
        console.log(`  ✅ Created: ${issueType.issueName}`);
        totalCreated++;
      }
    }

    console.log(`\n🎉 Total issue types created: ${totalCreated}`);
    console.log("\n📊 Summary by department:");
    
    for (const [department, issueTypes] of Object.entries(departmentIssueTypes)) {
      const count = await IssueType.countDocuments({ department });
      console.log(`  ${department}: ${count} issue types`);
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding issue types:", error);
    process.exit(1);
  }
}

seedIssueTypes();
