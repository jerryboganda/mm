import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area,
} from 'recharts';
import { Loader2, TrendingUp, BarChart3, BookOpen } from 'lucide-react';

interface UserGrowthPoint { date: string; count: number; }
interface QuizPoint { date: string; attempts: number; avgScore: number; }
interface ContentStat { bookId: string; bookTitle: string; chapterCount: number; topicCount: number; mcqCount: number; }

export default function AnalyticsPage() {
  const [userGrowth, setUserGrowth] = useState<UserGrowthPoint[]>([]);
  const [quizData, setQuizData] = useState<QuizPoint[]>([]);
  const [contentStats, setContentStats] = useState<ContentStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<UserGrowthPoint[]>('/admin/analytics/user-growth?days=30'),
      api.get<QuizPoint[]>('/admin/analytics/quiz'),
      api.get<ContentStat[]>('/admin/analytics/content'),
    ])
      .then(([ug, qd, cs]) => {
        setUserGrowth(ug);
        setQuizData(qd);
        setContentStats(cs);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-500 mt-1">Platform performance insights — last 30 days</p>
      </div>

      {/* User Growth */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold text-gray-900">User Registrations</h2>
        </div>
        {userGrowth.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={userGrowth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Area type="monotone" dataKey="count" stroke="#ec4899" fill="#fce7f3" strokeWidth={2} name="New Users" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-400 text-center py-12">No user registration data available.</p>
        )}
      </div>

      {/* Quiz Analytics */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-amber-500" />
          <h2 className="text-lg font-semibold text-gray-900">Quiz Activity</h2>
        </div>
        {quizData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={quizData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar yAxisId="left" dataKey="attempts" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Attempts" />
              <Line yAxisId="right" type="monotone" dataKey="avgScore" stroke="#10b981" strokeWidth={2} name="Avg Score %" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-400 text-center py-12">No quiz data available yet.</p>
        )}
      </div>

      {/* Content Stats per Book */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-purple-500" />
          <h2 className="text-lg font-semibold text-gray-900">Content Distribution</h2>
        </div>
        {contentStats.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Book</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Chapters</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Topics</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">MCQs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {contentStats.map((cs) => (
                  <tr key={cs.bookId} className="hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm font-medium text-gray-900">{cs.bookTitle}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium">{cs.chapterCount}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium">{cs.topicCount}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-amber-50 text-amber-700 rounded-lg text-sm font-medium">{cs.mcqCount}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-400 text-center py-12">No content data available.</p>
        )}
      </div>
    </div>
  );
}
