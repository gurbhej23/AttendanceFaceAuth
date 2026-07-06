import { lazy, Suspense, type ReactNode } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";

import MessagingDrawer from "./components/chat/MessagingDrawer";
import AnimatedPage from "./components/motion/AnimatedPage";
import ThemeToggle from "./components/common/ThemeToggle";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/RegisterEmployee";
import FaceVerification from "./pages/auth/FaceVerification";
import VerificationChoice from "./pages/VerificationChoice";
import EmailOtpVerification from "./pages/auth/EmailOtpVerification";
import PinVerification from "./pages/auth/PinVerification";
import Dashboard from "./pages/employee/Dashboard";
import CheckOut from "./pages/employee/CheckOut";
import AdminAttendanceSheet from "./pages/admin/AdminAttendanceSheet";
import AdminLogin from "./pages/admin/AdminLogin";
import ForgotPassword from "./pages/auth/ForgotPassword";
import Profile from "./pages/employee/Profile";

const AdminEmployees = lazy(() => import("./pages/admin/AdminEmployees"));
const AdminCreateEmployee = lazy(() => import("./pages/admin/AdminCreateEmployee"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminProfile = lazy(() => import("./pages/admin/AdminProfile"));
const AdminHR = lazy(() => import("./pages/admin/AdminHR"));
const TeamDirectory = lazy(() => import("./pages/TeamDirectory"));

const SIDEBAR_ROUTES = ["/dashboard", "/attendance-sheet"];

function withPageTransition(element: ReactNode) {
  return <AnimatedPage>{element}</AnimatedPage>;
}

function AppThemeToggle() {
  const { pathname } = useLocation();
  const hasSidebar = SIDEBAR_ROUTES.includes(pathname);

  if (hasSidebar) {
    return null;
  }

  return <ThemeToggle variant="fab" />;
}

function App() {
  const location = useLocation();

  const renderLazyRoute = (element: ReactNode) => (
    <Suspense fallback={<div className="p-4 text-center">Loading…</div>}>{element}</Suspense>
  );

  return (
    <>
      <AppThemeToggle />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Login />} />

          <Route path="/register" element={<Register />} />

          <Route path="/verify-choice" element={<VerificationChoice />} />
          <Route path="/verify-face" element={<FaceVerification />} />
          <Route path="/verify-otp" element={<EmailOtpVerification />} />
          <Route path="/verify-pin" element={<PinVerification />} />

          <Route path="/dashboard" element={withPageTransition(<Dashboard />)} />

          <Route path="/check-out" element={withPageTransition(<CheckOut />)} />

          <Route
            path="/attendance-sheet"
            element={withPageTransition(<AdminAttendanceSheet />)}
          />

          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/profile" element={withPageTransition(<Profile />)} />
          <Route
            path="/admin-employees"
            element={withPageTransition(renderLazyRoute(<AdminEmployees />))}
          />
          <Route
            path="/admin-create-employee"
            element={withPageTransition(renderLazyRoute(<AdminCreateEmployee />))}
          />
          <Route
            path="/admin-analytics"
            element={withPageTransition(renderLazyRoute(<AdminAnalytics />))}
          />
          <Route
            path="/admin-profile"
            element={withPageTransition(renderLazyRoute(<AdminProfile />))}
          />
          <Route path="/admin-hr" element={withPageTransition(renderLazyRoute(<AdminHR />))} />
          <Route path="/team" element={withPageTransition(renderLazyRoute(<TeamDirectory />))} />
        </Routes>
      </AnimatePresence>
      <MessagingDrawer />
    </>
  );
}

export default App;
