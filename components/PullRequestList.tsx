'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchWithAuth } from '../lib/fetchWithAuth';

interface PullRequestSummary {
  id: number;
  pullRequestNumber: number;
  title: string;
  state: string;
  authorGithubId: string;
  link: string;
  commitCount: number;
}

interface PullRequestListData {
  pullRequests: PullRequestSummary[];
}

const AVATAR_COLORS = [
  { bg: 'bg-indigo-100', text: 'text-indigo-600' },
  { bg: 'bg-orange-100', text: 'text-orange-600' },
  { bg: 'bg-blue-100', text: 'text-blue-600' },
  { bg: 'bg-teal-100', text: 'text-teal-600' },
  { bg: 'bg-rose-100', text: 'text-rose-600' },
  { bg: 'bg-violet-100', text: 'text-violet-600' },
];

function getAuthorColor(author: string) {
  let hash = 0;
  for (let i = 0; i < author.length; i++) hash = author.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function statusConfig(state: string) {
  switch (state) {
    case 'OPEN':
      return { label: 'Open', bg: 'bg-green-100', text: 'text-green-800', iconColor: 'text-green-500' };
    case 'MERGED':
      return { label: 'Merged', bg: 'bg-purple-100', text: 'text-purple-800', iconColor: 'text-purple-500' };
    case 'CLOSED':
      return { label: 'Closed', bg: 'bg-slate-100', text: 'text-slate-600', iconColor: 'text-slate-400' };
    case 'DRAFT':
      return { label: 'Draft', bg: 'bg-yellow-100', text: 'text-yellow-800', iconColor: 'text-yellow-500' };
    default:
      return { label: state, bg: 'bg-slate-100', text: 'text-slate-600', iconColor: 'text-slate-400' };
  }
}

export default function PullRequestList({ projectId }: { projectId: string }) {
  const [prs, setPrs] = useState<PullRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchWithAuth(`/projects/${projectId}/pull-requests`);
        if (!res.ok) {
          setError('PR 목록을 불러오는데 실패했습니다.');
          return;
        }
        const data: PullRequestListData = await res.json();
        setPrs(data.pullRequests);
      } catch {
        setError('서버에 연결할 수 없습니다.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [projectId]);

  const hasPRs = prs.length > 0;

  return (
    <main
      className="flex-grow w-full max-w-7xl mx-auto px-6 py-6 pb-32 transition-opacity duration-300 ease-in-out"
      style={{ opacity: isReady ? 1 : 0 }}
    >
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                PR 목록
                {!loading && hasPRs && (
                  <span className="bg-indigo-100 text-indigo-600 text-sm font-bold px-2.5 py-0.5 rounded-full">
                    {prs.length}
                  </span>
                )}
              </h1>
              <p className="text-slate-600 mt-2">프로젝트의 Pull Request 현황입니다.</p>
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

        {/* Empty State */}
        {!loading && !error && !hasPRs && (
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-indigo-50 shadow-sm">
            <div className="w-32 h-32 bg-slate-50 rounded-full flex items-center justify-center mb-6">
              <svg className="w-12 h-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">아직 PR이 없습니다!</h2>
            <p className="text-slate-500 text-center max-w-sm">
              새로운 Pull Request가 생성되면 이곳 리스트에 자동으로 업데이트됩니다.
            </p>
          </div>
        )}

        {/* PR List */}
        {!loading && !error && hasPRs && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Board Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <div className="col-span-8 md:col-span-7">Title / Commits</div>
              <div className="col-span-2 hidden md:block">Author</div>
              <div className="col-span-2 hidden md:block text-right">PR #</div>
              <div className="col-span-4 md:col-span-1 text-right">Status</div>
            </div>

            {/* List Items */}
            <div className="divide-y divide-slate-100">
              {prs.map((pr) => {
                const status = statusConfig(pr.state);
                const color = getAuthorColor(pr.authorGithubId);
                const isClosed = pr.state === 'CLOSED';

                return (
                  <Link
                    key={pr.id}
                    href={`/projects/${projectId}/pull-requests/${pr.pullRequestNumber}`}
                    className="grid grid-cols-12 gap-4 px-6 py-5 items-center hover:bg-slate-50 transition-colors cursor-pointer group"
                  >
                    <div className="col-span-8 md:col-span-7">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Status Icon */}
                        {isClosed ? (
                          <svg className={`w-5 h-5 ${status.iconColor} shrink-0`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        ) : (
                          <svg className={`w-5 h-5 ${status.iconColor} shrink-0`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                          </svg>
                        )}
                        <div className="min-w-0">
                          <h3
                            className={[
                              'text-base font-semibold group-hover:text-indigo-600 transition-colors truncate',
                              isClosed ? 'text-slate-500 line-through decoration-slate-400' : 'text-slate-800',
                            ].join(' ')}
                            title={pr.title}
                          >
                            {pr.title}
                            <span className="text-slate-400 font-normal ml-1 text-sm">({pr.commitCount})</span>
                          </h3>
                          <p className="text-xs text-slate-400 mt-0.5 md:hidden truncate">
                            By {pr.authorGithubId} · #{pr.pullRequestNumber}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="col-span-2 hidden md:flex items-center gap-2 min-w-0">
                      <div className={`w-6 h-6 rounded-full ${color.bg} ${color.text} flex items-center justify-center text-xs font-bold shrink-0`}>
                        {pr.authorGithubId[0]?.toUpperCase() || 'U'}
                      </div>
                      <span className={`text-sm truncate ${isClosed ? 'text-slate-400' : 'text-slate-600'}`} title={pr.authorGithubId}>
                        {pr.authorGithubId}
                      </span>
                    </div>
                    <div className={`col-span-2 hidden md:block text-right text-sm ${isClosed ? 'text-slate-400' : 'text-slate-500'}`}>
                      #{pr.pullRequestNumber}
                    </div>
                    <div className="col-span-4 md:col-span-1 text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                        {status.label}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Footer */}
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-sm text-slate-500">
                Showing {prs.length} entries
              </span>
            </div>
          </div>
        )}
    </main>
  );
}
