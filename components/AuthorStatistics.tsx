'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchWithAuth } from '../lib/fetchWithAuth';

interface AuthorStat {
  authorGithubId: string;
  pullRequestCount: number;
  totalAdditions: number;
  totalDeletions: number;
  averageAdditions: number;
  averageDeletions: number;
  averageCommitCount: number;
  averageChangedFileCount: number;
}

interface AuthorStatisticsData {
  authorStatistics: AuthorStat[];
}

function getInitials(name: string): string {
  return name
    .split(/[\s\-_]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

const AVATAR_COLORS = [
  { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-100' },
  { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-100' },
  { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100' },
  { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' },
  { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-100' },
  { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-100' },
];

const RANK_BADGES = [
  { bg: 'bg-yellow-400', text: 'text-yellow-900', label: '1st Place 🏆' },
  { bg: 'bg-slate-200', text: 'text-slate-600', label: '2nd Place 🥈' },
  { bg: 'bg-slate-100', text: 'text-slate-500', label: '3rd Place 🥉' },
];

function fmt(n: number): string {
  return n.toLocaleString();
}

function fmtAvg(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(1);
}

export default function AuthorStatistics({ projectId }: { projectId: string }) {
  const [authors, setAuthors] = useState<AuthorStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isReady, setIsReady] = useState(false);
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<unknown>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchWithAuth(`/projects/${projectId}/statistics/authors`);
        if (!res.ok) {
          setError('통계 데이터를 불러오는데 실패했습니다.');
          return;
        }
        const data: AuthorStatisticsData = await res.json();
        const sorted = [...data.authorStatistics].sort(
          (a, b) => b.pullRequestCount - a.pullRequestCount,
        );
        setAuthors(sorted);
      } catch {
        setError('서버에 연결할 수 없습니다.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [projectId]);

  // Chart.js (CDN으로 이미 로드됨)
  useEffect(() => {
    if (loading || authors.length === 0 || !chartRef.current) return;

    const tryRenderChart = () => {
      const win = window as unknown as Record<string, unknown>;
      if (!win.Chart) {
        setTimeout(tryRenderChart, 200);
        return;
      }
      const ChartJS = win.Chart as any;

      if (chartInstanceRef.current) {
        (chartInstanceRef.current as any).destroy();
      }

      const ctx = chartRef.current!.getContext('2d')!;
      chartInstanceRef.current = new ChartJS(ctx, {
        type: 'bar',
        data: {
          labels: authors.map((a) => a.authorGithubId.length > 15 ? a.authorGithubId.slice(0, 15) + '…' : a.authorGithubId),
          datasets: [
            {
              label: 'Total PRs',
              data: authors.map((a) => a.pullRequestCount),
              backgroundColor: '#6366F1',
              borderRadius: 6,
              barPercentage: 0.6,
              yAxisID: 'y',
            },
            {
              label: 'Avg Commits/PR',
              data: authors.map((a) => Number(a.averageCommitCount.toFixed(1))),
              backgroundColor: '#CBD5E1',
              borderRadius: 6,
              barPercentage: 0.6,
              yAxisID: 'y1',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top' as const,
              align: 'end' as const,
              labels: { usePointStyle: true, boxWidth: 8 },
            },
          },
          scales: {
            x: { grid: { display: false } },
            y: {
              type: 'linear' as const,
              position: 'left' as const,
              grid: { color: '#F1F5F9' },
              title: { display: true, text: 'PR Count' },
            },
            y1: {
              type: 'linear' as const,
              position: 'right' as const,
              grid: { display: false },
              title: { display: true, text: 'Commits' },
            },
          },
        },
      });
    };

    tryRenderChart();

    return () => {
      if (chartInstanceRef.current) {
        (chartInstanceRef.current as any).destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [loading, authors]);

  return (
    <main
      className="flex-grow w-full max-w-7xl mx-auto px-6 py-6 pb-32 transition-opacity duration-300 ease-in-out"
      style={{ opacity: isReady ? 1 : 0 }}
    >
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">작성자별 통계</h1>
              <p className="text-slate-600 mt-2">프로젝트 기여자들의 활동량과 코드 변경 영향력을 분석합니다.</p>
            </div>
          </div>
        </div>

        {/* Error */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-red-500 font-medium mb-4">{error}</p>
            <a href="/projects" className="text-indigo-600 hover:underline text-sm font-medium">프로젝트 목록으로</a>
          </div>
        )}

        {/* Content */}
        {!loading && !error && authors.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-slate-500 font-medium">통계 데이터가 없습니다.</p>
          </div>
        )}

        {!loading && !error && authors.length > 0 && (
          <>
            {/* Overview Chart */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm mb-8">
              <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                PR 활동량 비교
              </h2>
              <div className="h-64 w-full">
                <canvas ref={chartRef} />
              </div>
            </div>

            {/* Author Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {authors.map((author, index) => {
                const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
                const initials = getInitials(author.authorGithubId) || 'U';
                const totalLines = author.totalAdditions + author.totalDeletions;
                const addPct = totalLines > 0 ? Math.round((author.totalAdditions / totalLines) * 100) : 50;
                const delPct = 100 - addPct;
                const rank = RANK_BADGES[index];

                return (
                  <div
                    key={author.authorGithubId}
                    className={[
                      'bg-white rounded-2xl border shadow-sm p-6 relative group cursor-pointer',
                      'transition-all duration-300 hover:-translate-y-1',
                      'hover:shadow-lg hover:border-indigo-300',
                      index < 3 && index === 0 ? 'border-indigo-100' : 'border-slate-200',
                      index >= 3 ? 'opacity-90 hover:opacity-100' : '',
                    ].join(' ')}
                  >
                    {/* Rank Badge */}
                    {rank && (
                      <div className={`absolute top-0 right-0 ${rank.bg} ${rank.text} text-xs font-bold px-3 py-1 rounded-bl-xl z-10 shadow-sm`}>
                        {rank.label}
                      </div>
                    )}

                    {/* Profile Header */}
                    <div className="flex items-center gap-4 mb-6 min-w-0">
                      <div className={`w-16 h-16 flex-shrink-0 rounded-full ${color.bg} ${color.text} flex items-center justify-center text-xl font-bold border-2 ${color.border}`}>
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate" title={author.authorGithubId}>
                          {author.authorGithubId}
                        </h3>
                        <div className="text-sm text-slate-500 font-mono truncate" title={`@${author.authorGithubId}`}>@{author.authorGithubId}</div>
                        <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700">
                          {author.pullRequestCount} PRs Merged
                        </div>
                      </div>
                    </div>

                    {/* Contribution Volume */}
                    <div className="mb-6">
                      <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Contribution Volume</span>
                        <span className="font-semibold text-slate-700">Total: {fmt(totalLines)} lines</span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                        <div style={{ width: `${addPct}%` }} className="h-full bg-emerald-400" />
                        <div style={{ width: `${delPct}%` }} className="h-full bg-rose-400" />
                      </div>
                      <div className="flex justify-between text-xs mt-1.5 font-medium">
                        <span className="text-emerald-600">+{fmt(author.totalAdditions)}</span>
                        <span className="text-rose-500">-{fmt(author.totalDeletions)}</span>
                      </div>
                    </div>

                    {/* Averages Grid */}
                    <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-50">
                      <div className="bg-slate-50 p-3 rounded-lg text-center">
                        <div className="text-xs text-slate-500 mb-0.5">Avg. Commits</div>
                        <div className="text-lg font-bold text-slate-800">{fmtAvg(author.averageCommitCount)}</div>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg text-center">
                        <div className="text-xs text-slate-500 mb-0.5">Avg. Files</div>
                        <div className="text-lg font-bold text-slate-800">{fmtAvg(author.averageChangedFileCount)}</div>
                      </div>
                      <div className="col-span-2 bg-slate-50 p-3 rounded-lg flex justify-between items-center px-4">
                        <span className="text-xs text-slate-500">Avg. Add / Del per PR</span>
                        <span className="text-sm font-bold text-slate-700">
                          <span className="text-emerald-600">+{fmtAvg(author.averageAdditions)}</span>
                          {' / '}
                          <span className="text-rose-500">-{fmtAvg(author.averageDeletions)}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
    </main>
  );
}
