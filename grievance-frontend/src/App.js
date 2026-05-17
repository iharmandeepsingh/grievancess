import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import StudentDashboard from "./pages/StudentDashboard";
import StudentWelfare from "./pages/StudentWelfare";
import Admission from "./pages/Admission";
import StudentSection from "./pages/StudentSection";
import Accounts from "./pages/Accounts";
import Examination from "./pages/Examination";
import Department from "./pages/Department";
import StudentHR from "./pages/StudentHR";
import StudentCRC from "./pages/StudentCRC";
import StaffDashboard from "./pages/StaffDashboard";
import AdminStaffDashboard from "./pages/AdminStaffDashboard"; // ✅ Rajesh (Worker) ka Dashboard
import AdminDashboard from "./pages/AdminDashboard";
import AccountAdminDashboard from "./pages/AccountAdminDashboard";
import StudentWelfareAdminDashboard from "./pages/StudentWelfareAdminDashboard";
import AdmissionAdminDashboard from "./pages/AdmissionAdminDashboard";
import StudentSectionAdminDashboard from "./pages/StudentSectionAdminDashboard";
import ExaminationAdminDashboard from "./pages/ExaminationAdminDashboard";
import AdminManageStaff from "./pages/AdminManageStaff";
import SchoolAdminDashboard from "./pages/SchoolAdminDashboard";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";



import HRAdminDashboard from "./pages/HRAdminDashboard";
import CRCAdminDashboard from "./pages/CRCAdminDashboard";
import TransportAdminDashboard from "./pages/TransportAdminDashboard";
import StudentTransport from "./pages/StudentTransport";
import IssueManagementPage from "./pages/IssueManagementPage"; // NEW: Smart Assignment Configuration

// Helper to decide where DEPT ADMINS (Priya) go
const getDeptAdminRoute = (department) => {
  if (!department) return "/admin/school";
  const dept = department.trim().toLowerCase();
  
  if (dept === "accounts") return "/admin/account";
  if (dept === "student welfare") return "/admin/studentwelfare";
  if (dept === "student section") return "/admin/studentsection";
  if (dept === "admission") return "/admin/admission";
  if (dept === "examination") return "/admin/examination";
  if (dept === "hr") return "/admin/hr";
  if (dept === "crc (placement)" || dept === "crc" || dept === "placement") return "/admin/crc";
  if (dept === "transport") return "/admin/transport";
  
  return "/admin/school";
};

function ProtectedRoute({ children, allowedRoles }) {
  const role = localStorage.getItem("grievance_role")?.toLowerCase();
  const id = localStorage.getItem("grievance_id")?.toUpperCase();
  const isDeptAdmin = localStorage.getItem("is_dept_admin") === "true"; // Boss (Priya)
  const isMasterAdmin = localStorage.getItem("is_master_admin") === "true"; // Kavita (New Master)
  const adminDept = localStorage.getItem("admin_department"); // Both Priya & Rajesh have this

  if (!role || !id) return <Navigate to="/" replace />;

  // 1. Master Admin Logic
  if (isMasterAdmin) {
    // Master can go anywhere provided the route allows admins
    return children;
  }

  // 2. Department Admin Logic (Priya)
  if (role === "admin" || (role === "staff" && isDeptAdmin)) {
    // Allowed routes: Her Dept Dashboard, Manage Staff, or Generic Staff pages
    // If she tries to go to root or login, redirect to HER dashboard
    if (window.location.pathname === "/" || window.location.pathname === "/staff/general") {
      return <Navigate to={getDeptAdminRoute(adminDept)} replace />;
    }
    return children;
  }

  // 3. Department Team Member Logic (Rajesh)
  // Condition: Role is Staff, NOT Boss, BUT has a Department assigned
  if (role === "staff" && !isDeptAdmin && adminDept) {
    const allowedPaths = ["/staff/admin", "/staff/general"];
    const currentPath = window.location.pathname.toLowerCase();

    // Agar Rajesh "StudentDashboard" ya "Dept Admin Dashboard" pe jane ki koshish kare -> Block
    if (!allowedPaths.includes(currentPath) && !currentPath.startsWith("/staff/admin")) {
      return <Navigate to="/staff/admin" replace />;
    }
    return children;
  }

  // 4. General Staff Logic (Unassigned)
  if (role === "staff" && !isDeptAdmin && !adminDept) {
    if (window.location.pathname !== "/staff/general") {
      return <Navigate to="/staff/general" replace />;
    }
    return children;
  }

  // 5. Student Logic
  if (role === "student") {
    if (!window.location.pathname.startsWith("/student/")) {
      return <Navigate to="/student/dashboard" replace />;
    }
    return children;
  }

  return children;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* --- STUDENT ROUTES --- */}
        <Route path="/student/dashboard" element={<ProtectedRoute allowedRoles={["student"]}><StudentDashboard /></ProtectedRoute>} />
        <Route path="/student/welfare" element={<ProtectedRoute allowedRoles={["student"]}><StudentWelfare /></ProtectedRoute>} />
        <Route path="/student/admission" element={<ProtectedRoute allowedRoles={["student"]}><Admission /></ProtectedRoute>} />
        <Route path="/student/section" element={<ProtectedRoute allowedRoles={["student"]}><StudentSection /></ProtectedRoute>} />
        <Route path="/student/accounts" element={<ProtectedRoute allowedRoles={["student"]}><Accounts /></ProtectedRoute>} />
        <Route path="/student/examination" element={<ProtectedRoute allowedRoles={["student"]}><Examination /></ProtectedRoute>} />
        <Route path="/student/department" element={<ProtectedRoute allowedRoles={["student"]}><Department /></ProtectedRoute>} />
        <Route path="/student/hr" element={<ProtectedRoute allowedRoles={["student"]}><StudentHR /></ProtectedRoute>} />
        <Route path="/student/crc" element={<ProtectedRoute allowedRoles={["student"]}><StudentCRC /></ProtectedRoute>} />
        <Route path="/student/transport" element={<ProtectedRoute allowedRoles={["student"]}><StudentTransport /></ProtectedRoute>} />

        {/* --- STAFF ROUTES --- */}

        {/* 1. General Staff (Unassigned) */}
        <Route path="/staff/general" element={<ProtectedRoute allowedRoles={["staff"]}><StaffDashboard /></ProtectedRoute>} />

        {/* 2. Department Worker (Rajesh - The Worker Dashboard) */}
        <Route path="/staff/admin" element={<ProtectedRoute allowedRoles={["staff"]}><AdminStaffDashboard /></ProtectedRoute>} />

        {/* Default Redirects for Staff */}
        <Route path="/staff" element={<Navigate to="/staff/general" replace />} />

        {/* --- ADMIN ROUTES (Bosses) --- */}
        <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={["admin"]}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/manage-staff" element={<ProtectedRoute allowedRoles={["admin", "staff"]}><AdminManageStaff /></ProtectedRoute>} />
        <Route path="/admin/smart-assignment" element={<ProtectedRoute allowedRoles={["admin", "staff"]}><IssueManagementPage /></ProtectedRoute>} /> {/* NEW: Smart Assignment Config */}

        {/* Dept Boss Dashboards */}
        <Route path="/admin/account" element={<ProtectedRoute allowedRoles={["admin", "staff"]}><AccountAdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/studentwelfare" element={<ProtectedRoute allowedRoles={["admin", "staff"]}><StudentWelfareAdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/admission" element={<ProtectedRoute allowedRoles={["admin", "staff"]}><AdmissionAdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/studentsection" element={<ProtectedRoute allowedRoles={["admin", "staff"]}><StudentSectionAdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/examination" element={<ProtectedRoute allowedRoles={["admin", "staff"]}><ExaminationAdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/school" element={<ProtectedRoute allowedRoles={["admin", "staff"]}><SchoolAdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/hr" element={<ProtectedRoute allowedRoles={["admin", "staff"]}><HRAdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/crc" element={<ProtectedRoute allowedRoles={["admin", "staff"]}><CRCAdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/transport" element={<ProtectedRoute allowedRoles={["admin", "staff"]}><TransportAdminDashboard /></ProtectedRoute>} />


        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Catch All */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;