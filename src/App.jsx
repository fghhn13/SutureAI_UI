import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import { useI18n } from "./i18n/index.js";
import LoginPage from "./pages/LoginPage";
import StudentDashboardPage from "./pages/StudentDashboardPage";
import TrainingReportPage from "./pages/TrainingReportPage";
import TrainingSessionPage from "./pages/TrainingSessionPage";

// Instructor pages and the print view load on demand, so students never download them.
const InstructorDashboardPage = lazy(() => import("./pages/instructor/InstructorDashboardPage"));
const InstructorStudentPage = lazy(() => import("./pages/instructor/InstructorStudentPage"));
const ReviewQueuePage = lazy(() => import("./pages/instructor/ReviewQueuePage"));
const ReportPrintPage = lazy(() => import("./pages/ReportPrintPage"));

const STAFF = ["instructor", "admin"];

/** Quiet placeholder while a lazy page's code downloads. */
function PageSkeleton() {
  const { t } = useI18n();
  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 md:px-8" aria-busy="true">
      <p className="sr-only" role="status">{t("common.loading")}</p>
      <div className="skeleton h-44" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="skeleton h-72" />
        <div className="skeleton h-72" />
      </div>
    </main>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageSkeleton />}>
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
    </Suspense>
  );
}
