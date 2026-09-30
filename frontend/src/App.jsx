import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './layouts/AppLayout';
import AuditPage from './pages/AuditPage';
import DashboardPage from './pages/DashboardPage';
import DocumentDetailsPage from './pages/DocumentDetailsPage';
import DocumentListPage from './pages/DocumentListPage';
import ExtractedDataPage from './pages/ExtractedDataPage';
import LoginPage from './pages/LoginPage';
import OcrResultsPage from './pages/OcrResultsPage';
import RegisterPage from './pages/RegisterPage';
import ReviewPage from './pages/ReviewPage';
import SettingsPage from './pages/SettingsPage';
import TableResultsPage from './pages/TableResultsPage';
import UploadPage from './pages/UploadPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/documents" element={<DocumentListPage />} />
        <Route path="/documents/:id" element={<DocumentDetailsPage />} />
        <Route path="/documents/:id/ocr" element={<OcrResultsPage />} />
        <Route path="/documents/:id/extraction" element={<ExtractedDataPage />} />
        <Route path="/documents/:id/tables" element={<TableResultsPage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/audit/:documentId" element={<AuditPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
