import { Routes, Route } from "react-router-dom";

import MessagingDrawer from "./components/chat/MessagingDrawer";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/RegisterEmployee";
import FaceVerification from "./pages/auth/FaceVerification";
import VerificationChoice from "./pages/VerificationChoice";
import EmailOtpVerification from "./pages/auth/EmailOtpVerification";
import Dashboard from "./pages/employee/Dashboard";
import CheckOut from "./pages/employee/CheckOut";
import AdminAttendanceSheet from "./pages/admin/AdminAttendanceSheet";
import AdminLogin from "./pages/admin/AdminLogin";
import ForgotPassword from "./pages/auth/ForgotPassword";
import Profile from "./pages/employee/Profile";
import AdminEmployees from "./pages/admin/AdminEmployees";
import AdminCreateEmployee from "./pages/admin/AdminCreateEmployee";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminProfile from "./pages/admin/AdminProfile";

function App() {
  return (
    <>
    <Routes>
      <Route path="/" element={<Login />} />

      <Route path="/register" element={<Register />} />

      <Route path="/verify-choice" element={<VerificationChoice />} />
      <Route path="/verify-face" element={<FaceVerification />} />
      <Route path="/verify-otp" element={<EmailOtpVerification />} />

      <Route path="/dashboard" element={<Dashboard />} />

      <Route path="/check-out" element={<CheckOut />} />

      <Route path="/attendance-sheet" element={<AdminAttendanceSheet />} />

      <Route path="/admin-login" element={<AdminLogin />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/admin-employees" element={<AdminEmployees />} />
      <Route path="/admin-create-employee" element={<AdminCreateEmployee/>}/>
      <Route path="/admin-analytics" element={<AdminAnalytics />} />
      <Route path="/admin-profile" element={<AdminProfile />} />
    </Routes>
    <MessagingDrawer />
    </>
  );
}

export default App;
