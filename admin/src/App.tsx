import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import BooksPage from './pages/BooksPage';
import ChaptersPage from './pages/ChaptersPage';
import TopicsPage from './pages/TopicsPage';
import TopicEditorPage from './pages/TopicEditorPage';
import McqsPage from './pages/McqsPage';
import UsersPage from './pages/UsersPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AnnouncementsPage from './pages/AnnouncementsPage';
import ContentReportsPage from './pages/ContentReportsPage';
import SettingsPage from './pages/SettingsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/books" element={<BooksPage />} />
                <Route path="/books/:bookId/chapters" element={<ChaptersPage />} />
                <Route path="/chapters/:chapterId/topics" element={<TopicsPage />} />
                <Route path="/topics/:topicId/edit" element={<TopicEditorPage />} />
                <Route path="/mcqs" element={<McqsPage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/announcements" element={<AnnouncementsPage />} />
                <Route path="/content-reports" element={<ContentReportsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
