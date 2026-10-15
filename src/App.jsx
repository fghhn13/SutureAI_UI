import { Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import InstructorDashboardPage from "./pages/instructor/InstructorDashboardPage";
import InstructorStudentPage from "./pages/instructor/InstructorStudentPage";
import ReviewQueuePage from "./pages/instructor/ReviewQueuePage";
import LoginPage from "./pages/LoginPage";
import StudentDashboardPage from "./pages/StudentDashboardPage";
import ReportPrintPage from "./pages/ReportPrintPage";
import TrainingReportPage from "./pages/TrainingReportPage";
import TrainingSessionPage from "./pages/TrainingSessionPage";

const STAFF = ["instructor", "admin"];

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute roles={["student"]} />}>
        <Route path="/" element={<StudentDashboardPage />} />
        {/* Optional segment: /train starts a session, /train/:id follows one. */}
        <Route path="/train/:sessionId?" element={<TrainingSessionPage />} />
      </Route>
      <Route element={<ProtectedRoute roles={STAFF} />}>
        <Route path="/instructor" element={<InstructorDashboardPage />} />
        <Route path="/instructor/students/:studentId" element={<InstructorStudentPage />} />
        <Route path="/instructor/reviews" element={<ReviewQueuePage />} />
      </Route>
      {/* Shared: students see their own reports, instructors their students'. */}
      <Route element={<ProtectedRoute />}>
        <Route path="/report" element={<TrainingReportPage />} />
        <Route path="/report/print" element={<ReportPrintPage />} />
      </Route>
    </Routes>
  );
}
