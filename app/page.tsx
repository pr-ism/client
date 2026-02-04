'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import SetupFlow from '../components/SetupFlow';

const featureItems = [
  {
    title: '실시간 알림',
    description:
      'PR 생성 시 슬랙으로 즉시 알림을 전달합니다. 리뷰 예약 기능을 통해 리뷰어와 리뷰이 모두에게 진행 상황을 빠르게 공유하여 협업 속도를 높입니다.',
    iconColor: 'bg-indigo-100 text-indigo-600',
    iconPath:
      'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9'
  },
  {
    title: '통계 및 지표 분석',
    description:
      '개발 생산성을 확인하고 병목 구간을 판단할 수 있는 핵심 지표를 제공합니다. 데이터에 기반하여 팀의 효율을 개선하세요.',
    iconColor: 'bg-rose-100 text-rose-600',
    iconPath:
      'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z'
  }
];

const loginModalClass = (open: boolean) =>
  [
    'fixed inset-0 z-50 flex items-center justify-center',
    open ? '' : 'pointer-events-none'
  ].join(' ');

const backdropClass = (open: boolean) =>
  [
    'fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300',
    open ? 'opacity-100' : 'opacity-0'
  ].join(' ');

const modalContentClass = (open: boolean) =>
  [
    'relative bg-[#EEF2FF] rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4 transform transition-all duration-300 border border-indigo-100',
    open ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
  ].join(' ');

export default function HomePage() {
  return (
    <Suspense>
      <HomePageContent />
    </Suspense>
  );
}

function HomePageContent() {
  const searchParams = useSearchParams();
  const [isModalOpen, setModalOpen] = useState(false);
  const [isMounted, setMounted] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [sessionExpiredToast, setSessionExpiredToast] = useState(false);
  // 초기값을 false로 설정하여 로딩 전에는 무조건 숨김
  const [isReady, setIsReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    setMounted(true);

    // 로그인 필요 시 모달 자동 오픈
    if (searchParams.get('requires_login') === 'true') {
      setModalOpen(true);
      window.history.replaceState({}, '', '/');
    }

    // 세션 만료 토스트
    if (searchParams.get('session_expired') === 'true') {
      setSessionExpiredToast(true);
      window.history.replaceState({}, '', '/');
      const toastTimer = setTimeout(() => setSessionExpiredToast(false), 5000);
      return () => clearTimeout(toastTimer);
    }
  }, [searchParams]);

  useEffect(() => {
    // 쿠키 체크 및 초기화 로직
    const cookies = document.cookie.split(';').map((entry) => entry.trim());

    const showSetupMatch = cookies.find((entry) => entry.startsWith('prism_show_setup='));
    if (showSetupMatch) {
      setShowSetup(true);
      document.cookie = 'prism_show_setup=; path=/; max-age=0';
    }

    // 로그인 상태 확인
    const hasAccessToken = cookies.some((entry) => entry.startsWith('prism_access_token='));
    setIsLoggedIn(hasAccessToken);

    // setTimeout을 사용하여 CSS 로딩 및 렌더링 안정화 시간을 확실히 확보
    // 100ms 지연 후 화면 표시 (사용자는 거의 느끼지 못하지만 FOUC 방지에 효과적)
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const openModal = useCallback(() => setModalOpen(true), []);
  const closeModal = useCallback(() => setModalOpen(false), []);
  const closeSetup = useCallback(() => setShowSetup(false), []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isModalOpen) {
          closeModal();
          return;
        }
        if (showSetup) {
          closeSetup();
        }
      }
    },
    [closeModal, closeSetup, isModalOpen, showSetup]
  );

  useEffect(() => {
    if (!isMounted) {
      return;
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, isMounted]);

  useEffect(() => {
    if (showSetup) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [showSetup]);

  useEffect(() => {
    if (!showProfileMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.profile-menu-container')) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfileMenu]);

  const handleAddToSlack = useCallback(() => {
    const hasToken = document.cookie
      .split(';')
      .some((c) => c.trim().startsWith('prism_access_token='));
    if (hasToken) {
      window.location.href = '/setup';
    } else {
      openModal();
    }
  }, [openModal]);

  const handleSocialLogin = useCallback((provider: 'kakao' | 'google') => {
    const url = `/oauth2/authorization/${provider}`;
    window.location.href = url;
  }, []);

  const handleLogout = useCallback(() => {
    document.cookie = 'prism_access_token=; path=/; max-age=0';
    setIsLoggedIn(false);
    setShowProfileMenu(false);
    window.location.reload();
  }, []);

  const toggleProfileMenu = useCallback(() => {
    setShowProfileMenu(prev => !prev);
  }, []);

  return (
    <div
      className="flex flex-col min-h-screen transition-opacity duration-500 ease-in-out"
      // Tailwind 클래스가 로드되기 전에도 동작하도록 인라인 스타일 사용 (중요)
      style={{
        opacity: isReady ? 1 : 0,
        visibility: isReady ? 'visible' : 'hidden'
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Pretendard:wght@300;400;600;700&display=swap');

        body { font-family: 'Pretendard', sans-serif; }

        /* Smooth scrolling */
        html { scroll-behavior: smooth; }

        /* Subtle Entrance Animation */
        .fade-in-up {
            animation: fadeInUp 0.8s ease-out forwards;
            opacity: 0;
            transform: translateY(20px);
        }

        .delay-100 { animation-delay: 0.1s; }
        .delay-200 { animation-delay: 0.2s; }
        .delay-300 { animation-delay: 0.3s; }

        @keyframes fadeInUp {
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
      `}} />

      <nav className="w-full px-8 py-6 flex justify-between items-center max-w-6xl mx-auto">
        <div className="font-bold text-xl text-indigo-900 tracking-tight flex items-center gap-2">
          <svg width="24" height="24" viewBox="0 0 300 300" fill="none">
            <path
              d="M150 40 L150 260 L250 140 Z"
              fill="#6366F1"
              stroke="#1E293B"
              strokeWidth="20"
              strokeLinejoin="round"
            />
            <path
              d="M150 40 L50 180 L150 260 Z"
              fill="#FFFFFF"
              stroke="#1E293B"
              strokeWidth="20"
              strokeLinejoin="round"
            />
          </svg>
          PR-ism
        </div>
        {isLoggedIn ? (
          <div className="relative profile-menu-container">
            <button
              onClick={toggleProfileMenu}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold p-2 rounded-full shadow-md shadow-indigo-200 transition-all transform hover:-translate-y-0.5 flex items-center gap-2"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </button>
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-50">
                <a
                  href="/projects"
                  className="block px-4 py-2 text-sm text-slate-700 hover:bg-indigo-50 transition-colors"
                >
                  내 프로젝트
                </a>
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-indigo-50 transition-colors"
                >
                  로그아웃
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={(event) => {
              event.preventDefault();
              openModal();
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-full shadow-md shadow-indigo-200 transition-all transform hover:-translate-y-0.5 text-sm flex items-center gap-2"
          >
            Login
          </button>
        )}
      </nav>

      <main className="flex-grow flex flex-col items-center justify-center px-6 py-12 md:py-20 max-w-5xl mx-auto w-full">
        <div className="text-center mb-16 fade-in-up">
          <div className="w-32 h-32 mx-auto mb-8 relative">
            <div className="absolute inset-0 bg-indigo-200 blur-3xl opacity-40 rounded-full" />
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 300 300"
              fill="none"
              className="relative z-10 drop-shadow-xl"
            >
              <path
                d="M150 40 L150 260 L250 140 Z"
                fill="#6366F1"
                stroke="#1E293B"
                strokeWidth="15"
                strokeLinejoin="round"
              />
              <path
                d="M150 40 L50 180 L150 260 Z"
                fill="#FFFFFF"
                stroke="#1E293B"
                strokeWidth="15"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6 leading-tight">
            PR 리뷰를 자동화하고,
            <br />
            병목을 드러내다
          </h1>
          <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            당신의 PR이 프리즘을 통과하면 다채로운 인사이트가 됩니다.
            <br />
            알림부터 인사이트까지 PR-ism으로 끝내세요.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <button
              type="button"
              onClick={handleAddToSlack}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-full shadow-lg shadow-indigo-200 transition-all transform hover:-translate-y-1 flex items-center justify-center gap-2"
            >
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Slack_icon_2019.svg/50px-Slack_icon_2019.svg.png"
                alt="Slack Logo"
                className="w-5 h-5 brightness-0 invert"
              />
              Add to Slack
            </button>
            <button
              type="button"
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              className="bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold py-3 px-8 rounded-full shadow-sm transition-colors flex items-center justify-center"
            >
              Learn More
            </button>
          </div>
        </div>

        <div
          id="features"
          className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl fade-in-up delay-100"
        >
          {featureItems.map((feature) => (
            <div
              key={feature.title}
              className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl border border-indigo-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <div
                className={`w-12 h-12 ${feature.iconColor} rounded-2xl flex items-center justify-center mb-6`}
              >
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
                    d={feature.iconPath}
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">{feature.title}</h3>
              <p className="text-slate-500 leading-relaxed text-sm">{feature.description}</p>
            </div>
          ))}
        </div>

        <div className="w-full mt-20 fade-in-up delay-200">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden max-w-2xl mx-auto font-sans">
            <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900">#dev-team-alerts</span>
                <span className="text-xs text-slate-500 border border-slate-300 rounded px-1">🔒</span>
              </div>
            </div>
            <div className="p-5 hover:bg-slate-50 transition-colors">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-indigo-100 rounded-[4px] flex-shrink-0 flex items-center justify-center overflow-hidden">
                  <svg width="36" height="36" viewBox="0 0 300 300" fill="none">
                    <rect width="300" height="300" fill="#EEF2FF" />
                    <path
                      d="M150 40 L150 260 L250 140 Z"
                      fill="#6366F1"
                      stroke="#1E293B"
                      strokeWidth="15"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M150 40 L50 180 L150 260 Z"
                      fill="#FFFFFF"
                      stroke="#1E293B"
                      strokeWidth="15"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-bold text-slate-900 text-[15px]">PR-ism</span>
                    <span className="text-[10px] text-white bg-slate-400 px-1 py-[1px] rounded-[2px] font-bold uppercase tracking-wide">
                      APP
                    </span>
                    <span className="text-xs text-slate-500 font-light">1:24 PM</span>
                  </div>
                  <div className="text-[15px] leading-relaxed text-slate-900 mb-1">
                    🚀 <span className="font-bold">New PR:</span>{' '}
                    <span className="text-[#1264a3] hover:underline font-semibold cursor-pointer">
                      Refactor user authentication logic (#1024)
                    </span>
                  </div>
                  <div className="mt-2 flex">
                    <div className="w-1 bg-[#6366F1] rounded-l-sm mr-3 flex-shrink-0"></div>
                    <div className="flex-1 py-1">
                      <p className="text-[15px] text-slate-700 mb-3">새로운 PR이 도착했습니다!</p>
                      <div className="flex gap-12 mb-4 text-[15px]">
                        <div>
                          <div className="font-bold text-slate-900 mb-0.5">리뷰이</div>
                          <span className="text-slate-700">@kim-dev</span>
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 mb-0.5">리뷰어</div>
                          <span className="text-slate-700">@park-lead</span>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <button className="px-4 py-1.5 border border-slate-300 rounded font-bold text-slate-700 text-sm hover:bg-slate-50 transition-colors bg-white">
                          리뷰 예약
                        </button>
                        <button className="px-4 py-1.5 border border-[#007a5a] bg-[#007a5a] text-white rounded font-bold text-sm hover:bg-[#148567] transition-colors shadow-sm">
                          리뷰 바로 시작
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p className="text-center text-slate-400 text-xs mt-4 font-medium">
            실제 Slack 환경에서의 알림 예시 화면입니다.
          </p>
        </div>
      </main>

      <footer className="text-center py-8 text-slate-400 text-sm">
        <p>&copy; 2024 PR-ism. All rights reserved.</p>
      </footer>

      <div className={loginModalClass(isModalOpen)}>
        <div className={backdropClass(isModalOpen)} onClick={closeModal} />
        <div className={modalContentClass(isModalOpen)}>
          <button
            type="button"
            onClick={closeModal}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-white/50"
            aria-label="close modal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">로그인</h2>
            <p className="text-slate-500 text-sm">PR-ism을 시작하려면 로그인해주세요.</p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => handleSocialLogin('google')}
              className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-3 transition-colors shadow-sm group"
            >
              <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              구글 아이디로 로그인
            </button>
            <button
              type="button"
              onClick={() => handleSocialLogin('kakao')}
              className="w-full bg-[#FEE500] hover:bg-[#FDD835] text-[#191919] font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-3 transition-colors shadow-sm group"
            >
              <svg className="w-6 h-6 group-hover:scale-110 transition-transform text-[#3C1E1E]" viewBox="0 0 24 24">
                <path d="M12 3C7.58 3 4 5.79 4 9.24C4 11.33 5.35 13.16 7.43 14.24L6.56 17.42C6.46 17.79 6.87 18.09 7.18 17.88L11.08 15.29C11.38 15.33 11.69 15.35 12 15.35C16.42 15.35 20 12.56 20 9.11C20 5.66 16.42 3 12 3Z" />
              </svg>
              카카오 아이디로 로그인
            </button>
          </div>
        </div>
      </div>

      {showSetup && (
        <div className="fixed inset-0 z-40 bg-white overflow-y-auto shadow-2xl">
          <SetupFlow onRequestMain={closeSetup} />
        </div>
      )}

      {/* Session Expired Toast */}
      <div
        className={[
          'fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-white border border-rose-200 shadow-lg rounded-xl px-5 py-4 transition-all duration-300',
          sessionExpiredToast
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-4 pointer-events-none',
        ].join(' ')}
      >
        <div className="w-8 h-8 bg-rose-100 rounded-full flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">세션이 만료되었습니다</p>
          <p className="text-xs text-slate-500">다시 로그인해 주세요.</p>
        </div>
        <button
          onClick={() => setSessionExpiredToast(false)}
          className="ml-2 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
