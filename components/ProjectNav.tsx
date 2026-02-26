'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { fetchWithAuth } from '../lib/fetchWithAuth';

interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface ProjectResponse {
  id: number;
  name: string;
}

interface ProjectListData {
  projects: ProjectResponse[];
}

function resolveActive(pathname: string): string {
  if (pathname.includes('/statistics/weekly-trend')) return 'weekly-trend';
  if (pathname.includes('/statistics/throughput')) return 'throughput';
  if (pathname.includes('/statistics/review-speed')) return 'review-speed';
  if (pathname.includes('/statistics/review-quality')) return 'review-quality';
  if (pathname.includes('/statistics/pullrequest-size')) return 'pullrequest-size';
  if (pathname.includes('/statistics/lifecycle')) return 'lifecycle';
  if (pathname.includes('/statistics/daily-trend')) return 'daily-trend';
  if (pathname.includes('/statistics/collaboration')) return 'collaboration';
  if (pathname.includes('/statistics/summary')) return 'summary';
  if (pathname.includes('/statistics/size')) return 'size';
  if (pathname.includes('/statistics/hot-files')) return 'hot-files';
  if (pathname.includes('/statistics/authors')) return 'authors';
  if (pathname.includes('/statistics/reviewers')) return 'reviewers';
  if (pathname.includes('/statistics/labels')) return 'labels';
  if (pathname.includes('/statistics/trends')) return 'trends';
  return 'pull-requests';
}

function retriggerTailwind() {
  // Tailwind CDN은 MutationObserver로 동작하므로
  // 미세한 DOM 변경을 일으켜 observer를 트리거한다
  const marker = document.createElement('span');
  marker.setAttribute('data-tw-refresh', '');
  document.body.appendChild(marker);
  requestAnimationFrame(() => marker.remove());
}

export default function ProjectNav({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const active = resolveActive(pathname);
  const prevPathRef = useRef(pathname);
  const [projectName, setProjectName] = useState('');

  // pathname 변경 시 Tailwind CDN 재스캔
  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      prevPathRef.current = pathname;
      requestAnimationFrame(() => retriggerTailwind());
    }
  }, [pathname]);

  useEffect(() => {
    let active = true;

    const loadProjectName = async () => {
      try {
        const res = await fetchWithAuth('/projects');
        if (!res.ok) return;

        const data: ProjectListData = await res.json();
        const currentProject = data.projects.find((project) => String(project.id) === projectId);
        if (active && currentProject?.name) {
          setProjectName(currentProject.name);
        }
      } catch {
        // Ignore fetch errors and keep fallback text.
      }
    };

    loadProjectName();

    return () => {
      active = false;
    };
  }, [projectId]);

  const handleTabClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      e.preventDefault();
      router.push(href);
      // 약간의 지연 후 tailwind 재스캔
      setTimeout(() => retriggerTailwind(), 50);
      setTimeout(() => retriggerTailwind(), 150);
    },
    [router],
  );

  const items: NavItem[] = [
    {
      key: 'pull-requests',
      label: 'Pull Requests',
      href: `/projects/${projectId}/pull-requests`,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      ),
    },
    {
      key: 'summary',
      label: 'Summary Stats',
      href: `/projects/${projectId}/statistics/summary`,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      key: 'collaboration',
      label: 'Collab Stats',
      href: `/projects/${projectId}/statistics/collaboration`,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      key: 'daily-trend',
      label: 'Daily Trend',
      href: `/projects/${projectId}/statistics/daily-trend`,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
      ),
    },
    {
      key: 'weekly-trend',
      label: 'Weekly Trend',
      href: `/projects/${projectId}/statistics/weekly-trend`,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
      ),
    },
    {
      key: 'lifecycle',
      label: 'Lifecycle',
      href: `/projects/${projectId}/statistics/lifecycle`,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      key: 'pullrequest-size',
      label: 'PR Size',
      href: `/projects/${projectId}/statistics/pullrequest-size`,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      key: 'throughput',
      label: 'Throughput',
      href: `/projects/${projectId}/statistics/throughput`,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
        </svg>
      ),
    },
    {
      key: 'review-quality',
      label: 'Review Quality',
      href: `/projects/${projectId}/statistics/review-quality`,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016" />
        </svg>
      ),
    },
    {
      key: 'review-speed',
      label: 'Review Speed',
      href: `/projects/${projectId}/statistics/review-speed`,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      key: 'trends',
      label: 'Trend Stats',
      href: `/projects/${projectId}/statistics/trends`,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
      ),
    },
  ];

  return (
    <div>
      {/* Breadcrumb */}
      <div className="w-full max-w-7xl mx-auto px-8 pb-3">
        <div className="flex items-center gap-1.5 text-sm text-slate-400">
          <button onClick={() => router.push('/projects')} className="hover:text-indigo-600 transition-colors">Projects</button>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
          <span className="text-slate-700 text-base font-semibold">{projectName || 'Project'}</span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="w-full max-w-7xl mx-auto px-6 pb-4">
        <div className="bg-white/60 backdrop-blur-sm rounded-xl p-1.5 border border-slate-200/80 shadow-sm overflow-x-auto">
          <div className="flex gap-1 w-max min-w-full">
            {items.map((item) => {
              const isActive = item.key === active;
              return (
                <a
                  key={item.key}
                  href={item.href}
                  onClick={(e) => handleTabClick(e, item.href)}
                  className={[
                    'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap',
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-white/80',
                  ].join(' ')}
                >
                  {item.icon}
                  {item.label}
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
