'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchWithAuth } from '../lib/fetchWithAuth';

interface ChangeStats {
  changedFileCount: number;
  additionCount: number;
  deletionCount: number;
}

interface Timing {
  pullRequestCreatedAt: string | null;
  mergedAt: string | null;
  closedAt: string | null;
}

interface PRDetail {
  id: number;
  pullRequestNumber: number;
  title: string;
  state: string;
  authorGithubId: string;
  link: string;
  commitCount: number;
  changeStats: ChangeStats;
  timing: Timing;
}

function fmt(n: number): string {
  return n.toLocaleString();
}

function fmtDate(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
    + ' · '
    + d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}


function statusBadge(state: string) {
  switch (state) {
    case 'MERGED':
      return { label: 'MERGED', bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' };
    case 'OPEN':
      return { label: 'OPEN', bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' };
    case 'CLOSED':
      return { label: 'CLOSED', bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' };
    case 'DRAFT':
      return { label: 'DRAFT', bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200' };
    default:
      return { label: state, bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' };
  }
}

export default function PullRequestDetail({
  projectId,
  pullRequestNumber,
}: {
  projectId: string;
  pullRequestNumber: string;
}) {
  const [pr, setPr] = useState<PRDetail | null>(null);
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
        const res = await fetchWithAuth(
          `/projects/${projectId}/pull-requests/${pullRequestNumber}`,
        );
        if (!res.ok) {
          setError('PR 정보를 불러오는데 실패했습니다.');
          return;
        }
        const data: PRDetail = await res.json();
        setPr(data);
      } catch {
        setError('서버에 연결할 수 없습니다.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [projectId, pullRequestNumber]);

  // Doughnut chart
  useEffect(() => {
    if (!pr || !chartRef.current) return;

    const tryRender = () => {
      const win = window as unknown as Record<string, unknown>;
      if (!win.Chart) {
        setTimeout(tryRender, 200);
        return;
      }
      const ChartJS = win.Chart as any;
      if (chartInstanceRef.current) (chartInstanceRef.current as any).destroy();

      const ctx = chartRef.current!.getContext('2d')!;
      chartInstanceRef.current = new ChartJS(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Additions', 'Deletions'],
          datasets: [
            {
              data: [pr.changeStats.additionCount, pr.changeStats.deletionCount],
              backgroundColor: ['#34D399', '#FB7185'],
              borderWidth: 0,
              hoverOffset: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '75%',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx: any) => ` ${ctx.label}: ${ctx.raw} lines`,
              },
            },
          },
        },
      });
    };
    tryRender();

    return () => {
      if (chartInstanceRef.current) {
        (chartInstanceRef.current as any).destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [pr]);

  const totalLines = pr ? pr.changeStats.additionCount + pr.changeStats.deletionCount : 0;
  const addPct = totalLines > 0 ? Math.round((pr!.changeStats.additionCount / totalLines) * 100) : 0;
  const badge = pr ? statusBadge(pr.state) : null;

  return (
    <main
      className="flex-grow w-full max-w-7xl mx-auto px-6 py-6 pb-32 transition-opacity duration-300 ease-in-out"
      style={{ opacity: isReady ? 1 : 0 }}
    >
        {/* Error */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-red-500 font-medium mb-4">{error}</p>
            <a href={`/projects/${projectId}/pull-requests`} className="text-indigo-600 hover:underline text-sm font-medium">PR 목록으로</a>
          </div>
        )}

        {!loading && !error && pr && (
          <>
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
              <a href="/projects" className="hover:text-indigo-600 transition-colors">Projects</a>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
              <a href={`/projects/${projectId}/pull-requests`} className="hover:text-indigo-600 transition-colors">PR 목록</a>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
              <span className="font-semibold text-slate-800">PR #{pr.pullRequestNumber}</span>
            </div>

            {/* Header */}
            <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm mb-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full opacity-50 pointer-events-none" />
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`${badge!.bg} ${badge!.text} text-xs font-bold px-2.5 py-1 rounded-full border ${badge!.border} flex items-center gap-1`}>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                      {badge!.label}
                    </span>
                    <span className="text-slate-400 font-mono text-sm">#{pr.pullRequestNumber}</span>
                  </div>
                  <h1 className="text-2xl md:text-3xl font-bold text-slate-900 leading-tight mb-2 break-words">
                    {pr.title}
                  </h1>
                  <div className="flex items-center gap-4 text-sm text-slate-500 flex-wrap">
                    <span className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                        {pr.authorGithubId[0]?.toUpperCase() || 'U'}
                      </div>
                      <span className="font-medium text-slate-700 truncate max-w-[200px]" title={pr.authorGithubId}>{pr.authorGithubId}</span>
                    </span>
                  </div>
                </div>
                <a href={pr.link} target="_blank" rel="noopener noreferrer" className="shrink-0 flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
                  GitHub에서 보기
                </a>
              </div>
            </div>

            {/* Main Grid */}
            {/* Stat Cards + Author Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 grid grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
                  <div className="text-slate-500 text-xs font-semibold uppercase mb-1">Commits</div>
                  <div className="text-3xl font-bold text-slate-800">{pr.commitCount}</div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
                  <div className="text-slate-500 text-xs font-semibold uppercase mb-1">Files Changed</div>
                  <div className="text-3xl font-bold text-slate-800">{pr.changeStats.changedFileCount}</div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
                  <div className="text-slate-500 text-xs font-semibold uppercase mb-1">Total Impact</div>
                  <div className="text-3xl font-bold text-indigo-600">{fmt(totalLines)}</div>
                  <div className="text-slate-400 text-xs mt-1">lines modified</div>
                </div>
              </div>
              {/* Author */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Author</h3>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 border-2 border-white shadow-sm flex items-center justify-center text-xl font-bold text-indigo-600">
                      {pr.authorGithubId.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase() || 'U'}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-800 text-lg truncate" title={pr.authorGithubId}>{pr.authorGithubId}</div>
                      <div className="text-sm text-slate-500 font-mono truncate">@{pr.authorGithubId}</div>
                    </div>
                  </div>
              </div>
            </div>

            {/* Chart + Timeline Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
              <div className="lg:col-span-2">
                {/* Change Stats Chart */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                      변경 통계
                    </h3>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-400" /> Additions</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-rose-400" /> Deletions</span>
                    </div>
                  </div>
                  <div className="flex flex-col md:flex-row gap-8 items-center justify-center">
                    <div className="w-48 h-48 relative">
                      <canvas ref={chartRef} />
                      <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                        <span className="text-2xl font-bold text-slate-800">{fmt(totalLines)}</span>
                        <span className="text-xs text-slate-400">Lines</span>
                      </div>
                    </div>
                    <div className="flex-1 w-full space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-slate-700">Additions</span>
                          <span className="font-bold text-emerald-600">+{fmt(pr.changeStats.additionCount)}</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                          <div className="bg-emerald-400 h-2.5 rounded-full" style={{ width: `${addPct}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-slate-700">Deletions</span>
                          <span className="font-bold text-rose-500">-{fmt(pr.changeStats.deletionCount)}</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                          <div className="bg-rose-400 h-2.5 rounded-full" style={{ width: `${100 - addPct}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-5">
                  Timeline
                </h3>
                  <div className="relative pl-2 space-y-8">
                    {/* Connector line */}
                    <div className="absolute top-4 bottom-4 left-[15px] w-0.5 bg-slate-200" />

                    {/* Opened */}
                    {pr.timing.pullRequestCreatedAt && (
                      <div className="relative z-10 flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-green-100 border-2 border-white shadow-sm flex items-center justify-center shrink-0">
                          <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-800">PR Opened</div>
                          <div className="text-xs text-slate-500 mt-0.5">{fmtDate(pr.timing.pullRequestCreatedAt)}</div>
                        </div>
                      </div>
                    )}

                    {/* Commits */}
                    <div className="relative z-10 flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-blue-100 border-2 border-white shadow-sm flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-800">{pr.commitCount} Commits Pushed</div>
                        <div className="text-xs text-slate-500 mt-0.5">Active development</div>
                      </div>
                    </div>

                    {/* Merged / Closed */}
                    {pr.timing.mergedAt && (
                      <div className="relative z-10 flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-purple-100 border-2 border-white shadow-sm flex items-center justify-center shrink-0">
                          <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <div>
                          <div className="text-sm font-bold text-purple-700">Merged</div>
                          <div className="text-xs text-slate-500 mt-0.5">{fmtDate(pr.timing.mergedAt)}</div>
                        </div>
                      </div>
                    )}
                    {pr.timing.closedAt && !pr.timing.mergedAt && (
                      <div className="relative z-10 flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white shadow-sm flex items-center justify-center shrink-0">
                          <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-600">Closed</div>
                          <div className="text-xs text-slate-500 mt-0.5">{fmtDate(pr.timing.closedAt)}</div>
                        </div>
                      </div>
                    )}
                </div>
              </div>
            </div>
          </>
        )}
    </main>
  );
}
