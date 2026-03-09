import { Routes, Route, Navigate } from "react-router-dom";
import AuthPage from "./auth/auth-page";
import ResetPasswordPage from "./auth/reset-password-page";
import DashboardPage from "./user/dashboard-page";
import AccountPage from "./user/account-page";
import ProtectedRoute from "./components/ProtectedRoute";
import SubjectsPage from "./subjects/subjects-page";
import SubjectDetailPage from "./subjects/subject-detail-page";
import SubjectMaterialsPage from "./subjects/subject-materials-page";
import ClassesPage from "./classes/classes-page";
import MyClassPage from "./classes/my-class-page";
import StudentAnalyticsPage from "./student/analytics-page";
import StudentGenerationPage from "./student/generation-page";
import authService from "./auth/auth-service";

export default function Router() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={["admin"]} fallbackPath="/subjects">
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/account"
        element={
          <ProtectedRoute allowedRoles={["student", "teacher"]} fallbackPath="/dashboard">
            <AccountPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/subjects"
        element={
          <ProtectedRoute>
            <SubjectsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/subjects/:id"
        element={
          <ProtectedRoute>
            <SubjectDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/subjects/:id/materials"
        element={
          <ProtectedRoute>
            <SubjectMaterialsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/classes"
        element={
          <ProtectedRoute>
            <ClassesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-class/:classId"
        element={
          <ProtectedRoute>
            <MyClassPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute allowedRoles={["student"]} fallbackPath="/subjects">
            <StudentAnalyticsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/generation"
        element={
          <ProtectedRoute allowedRoles={["student"]} fallbackPath="/subjects">
            <StudentGenerationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            {authService.getRole() === "admin" ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Navigate to="/subjects" replace />
            )}
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
