import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import {
  Users, BookOpen, FileText, ClipboardList, BarChart3,
  TrendingUp, AlertTriangle, Activity, ArrowRight, Loader2,
} from 'lucide-react';

interface DashboardStats {
  totalUsers: number;
  totalBooks: number;
  totalChapters: number;
  totalTopics: number;
  totalMcqs: number;
  totalAttempts: number;
  publishedBooks: number;
  publishedTopics: number;
  publishedMcqs: number;
  pendingReports: number;
  newUsersThisWeek: number;
  activeUsersThisWeek: number;
}

function StatCard({ icon: Icon, label, value, color, subtitle }: {
  icon: any; label: string; value: number | string; color: string; subtitle?: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}

function QuickAction({ to, icon: Icon, label, description, color }: {
  to: string; icon: any; label: string; description: string; color: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all group"
    >
      <div className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900">{label}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
    </Link>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<DashboardStats>('/admin/analytics/dashboard')
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!stats) return <p className="text-gray-500">Failed to load dashboard.</p>;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Overview of your Maternal Mind platform</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Users" value={stats.totalUsers} color="bg-blue-500" subtitle={`+${stats.newUsersThisWeek} this week`} />
        <StatCard icon={Activity} label="Active Users" value={stats.activeUsersThisWeek} color="bg-green-500" subtitle="Last 7 days" />
        <StatCard icon={BookOpen} label="Books" value={`${stats.publishedBooks}/${stats.totalBooks}`} color="bg-purple-500" subtitle="Published / Total" />
        <StatCard icon={FileText} label="Topics" value={`${stats.publishedTopics}/${stats.totalTopics}`} color="bg-indigo-500" subtitle="Published / Total" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ClipboardList} label="MCQs" value={`${stats.publishedMcqs}/${stats.totalMcqs}`} color="bg-amber-500" subtitle="Published / Total" />
        <StatCard icon={BarChart3} label="Quiz Attempts" value={stats.totalAttempts} color="bg-cyan-500" />
        <StatCard icon={TrendingUp} label="Chapters" value={stats.totalChapters} color="bg-teal-500" />
        <StatCard icon={AlertTriangle} label="Pending Reports" value={stats.pendingReports} color={stats.pendingReports > 0 ? "bg-red-500" : "bg-gray-400"} />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <QuickAction to="/books" icon={BookOpen} label="Manage Content" description="Add or edit books, chapters, and topics" color="bg-primary-500" />
          <QuickAction to="/mcqs" icon={ClipboardList} label="Manage MCQs" description="Create, import, or edit quiz questions" color="bg-amber-500" />
          <QuickAction to="/users" icon={Users} label="Manage Users" description="View and manage user accounts" color="bg-blue-500" />
          <QuickAction to="/announcements" icon={TrendingUp} label="Announcements" description="Create announcements for app users" color="bg-green-500" />
          <QuickAction to="/content-reports" icon={AlertTriangle} label="Content Reports" description={`${stats.pendingReports} pending reports to review`} color="bg-red-500" />
          <QuickAction to="/analytics" icon={BarChart3} label="Analytics" description="View platform analytics and charts" color="bg-indigo-500" />
        </div>
      </div>
    </div>
  );
}
