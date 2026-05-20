import { Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/RegisterEmployee";
import FaceVerification from "./pages/FaceVerification";
import Dashboard from "./pages/Dashboard";
import CheckOut from "./pages/CheckOut";
import AdminAttendanceSheet from "./pages/AdminAttendanceSheet";
import AdminLogin from "./pages/AdminLogin";
import ForgotPassword from "./pages/ForgotPassword";
import Profile from "./pages/Profile";
import AdminEmployees from "./pages/AdminEmployees";
import AdminCreateEmployee from "./pages/AdminCreateEmployee";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />

      <Route path="/register" element={<Register />} />

      <Route path="/verify-face" element={<FaceVerification />} />

      <Route path="/dashboard" element={<Dashboard />} />

      <Route path="/check-out" element={<CheckOut />} />

      <Route path="/attendance-sheet" element={<AdminAttendanceSheet />} />

      <Route path="/admin-login" element={<AdminLogin />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/admin-employees" element={<AdminEmployees />} />
      <Route path="/admin-create-employee" element={<AdminCreateEmployee/>}/>
    </Routes>
  );
}

export default App;
