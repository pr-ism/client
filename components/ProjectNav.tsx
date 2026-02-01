'use client';

import { useEffect, useCallback, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';

interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: React.ReactNode;
}

function resolveActive(pathname: string): string {
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

  // pathname 변경 시 Tailwind CDN 재스캔
  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      prevPathRef.current = pathname;
      requestAnimationFrame(() => retriggerTailwind());
    }
  }, [pathname]);

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
      key: 'authors',
      label: 'Author Stats',
      href: `/projects/${projectId}/statistics/authors`,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      key: 'reviewers',
      label: 'Reviewer Stats',
      href: `/projects/${projectId}/statistics/reviewers`,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      key: 'size',
      label: 'Size Stats',
      href: `/projects/${projectId}/statistics/size`,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      ),
    },
    {
      key: 'hot-files',
      label: 'Hot Files',
      href: `/projects/${projectId}/statistics/hot-files`,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
        </svg>
      ),
    },
    {
      key: 'labels',
      label: 'Label Stats',
      href: `/projects/${projectId}/statistics/labels`,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
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
          <span className="text-slate-600 font-medium">Project #{projectId}</span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="w-full max-w-7xl mx-auto px-6 pb-4">
        <div className="flex gap-1 bg-white/60 backdrop-blur-sm rounded-xl p-1.5 border border-slate-200/80 shadow-sm">
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
  );
}
