'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchWithAuth } from '../lib/fetchWithAuth';

interface ProjectResponse {
  id: number;
  name: string;
}

interface ProjectListData {
  projects: ProjectResponse[];
}

function getInitials(name: string): string {
  return name
    .split(/[\s-_]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

const COLORS = [
  { bg: 'bg-indigo-100', text: 'text-indigo-600', border: 'border-indigo-50' },
  { bg: 'bg-sky-100', text: 'text-sky-600', border: 'border-sky-50' },
  { bg: 'bg-emerald-100', text: 'text-emerald-600', border: 'border-emerald-50' },
  { bg: 'bg-amber-100', text: 'text-amber-600', border: 'border-amber-50' },
  { bg: 'bg-rose-100', text: 'text-rose-600', border: 'border-rose-50' },
  { bg: 'bg-violet-100', text: 'text-violet-600', border: 'border-violet-50' },
];

function getColor(index: number) {
  return COLORS[index % COLORS.length];
}

export default function ProjectList() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetchWithAuth('/projects');

        if (!res.ok) {
          setError('프로젝트 목록을 불러오는데 실패했습니다.');
          setLoading(false);
          return;
        }

        const data: ProjectListData = await res.json();
        setProjects(data.projects);
      } catch {
        setError('서버에 연결할 수 없습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  const hasProjects = projects.length > 0;

  return (
    <main
      className="flex-grow w-full max-w-7xl mx-auto px-6 py-8 pb-32 transition-opacity duration-300 ease-in-out"
      style={{ opacity: isReady ? 1 : 0 }}
    >
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">프로젝트 목록</h1>
            <p className="text-slate-600">등록된 프로젝트 현황을 한눈에 확인하세요.</p>
          </div>
          {!loading && hasProjects && (
            <div>
              <a
                href="/setup"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-5 rounded-lg shadow-md shadow-indigo-100 transition-all flex items-center gap-2 text-sm"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                    clipRule="evenodd"
                  />
                </svg>
                새 프로젝트
              </a>
            </div>
          )}
        </div>

        {/* Error State */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-red-500 font-medium mb-4">{error}</p>
            <a href="/" className="text-indigo-600 hover:underline text-sm font-medium">
              홈으로 돌아가기
            </a>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && !hasProjects && (
          <div className="flex flex-col items-center justify-center py-20 fade-in-up">
            <div className="w-40 h-40 bg-white rounded-full flex items-center justify-center mb-8 shadow-sm border border-indigo-50 relative">
              <div className="absolute w-full h-full rounded-full border border-indigo-100 scale-125 opacity-50" />
              <div className="absolute w-full h-full rounded-full border border-indigo-50 scale-150 opacity-30" />
              <svg
                width="80"
                height="80"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#6366F1"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-slate-900 mb-3">등록된 프로젝트가 없습니다</h2>
            <p className="text-slate-500 mb-10 text-center max-w-md leading-relaxed">
              첫 번째 프로젝트를 생성해 PR 리뷰 관리를 시작해보세요!
            </p>

            <a
              href="/setup"
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-8 rounded-full shadow-lg transition-all transform hover:-translate-y-0.5 flex items-center gap-2"
            >
              PR-ism 시작하기
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </a>
          </div>
        )}

        {/* Project List */}
        {!loading && !error && hasProjects && (
          <div className="fade-in-up">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project, index) => {
                const color = getColor(index);
                const initials = getInitials(project.name) || 'P';
                return (
                  <div
                    key={project.id}
                    onClick={() => router.push(`/projects/${project.id}/pull-requests`)}
                    className={`bg-white rounded-2xl border ${color.border} p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg relative group block cursor-pointer`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div
                        className={`w-12 h-12 rounded-xl ${color.bg} ${color.text} flex items-center justify-center font-bold text-lg`}
                      >
                        {initials}
                      </div>
                      <svg
                        className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-6">{project.name}</h3>
                  </div>
                );
              })}

              {/* Add New Card */}
              <a
                href="/setup"
                className="rounded-2xl border-2 border-dashed border-slate-300 p-6 flex flex-col items-center justify-center text-slate-400 hover:border-indigo-400 hover:text-indigo-600 hover:bg-white transition-all cursor-pointer group h-full min-h-[180px]"
              >
                <div className="w-12 h-12 rounded-full bg-slate-100 group-hover:bg-indigo-50 flex items-center justify-center mb-3 transition-colors">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </div>
                <span className="font-semibold">새 프로젝트 추가</span>
              </a>
            </div>
          </div>
        )}
    </main>
  );
}
