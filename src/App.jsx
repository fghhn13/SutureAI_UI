import { Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import StudentDashboardPage from "./pages/StudentDashboardPage";
import TrainingReportPage from "./pages/TrainingReportPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<StudentDashboardPage />} />
        <Route path="/report" element={<TrainingReportPage />} />
      </Route>
    </Routes>
  );
}
