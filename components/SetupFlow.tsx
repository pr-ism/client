'use client';

import { useCallback, useEffect, useRef, useState, type MouseEvent, type RefObject } from 'react';
// removed next/navigation import to fix compilation error

type GithubTab = 'all' | 'notify' | 'pr-opened' | 'review-request-removed' | 'comment' | 'labeled' | 'review-submitted';

const githubTabs: { key: GithubTab; label: string; description: string; filename: string; src: string }[] = [
  { key: 'all', label: '통합', description: '모든 기능을 하나의 워크플로우 파일로 통합한 버전입니다.', filename: 'prism.yml', src: '/workflows/prism.yml' },
  { key: 'notify', label: '리뷰 요청 알림', description: '리뷰 요청 이벤트를 감지하여 Slack으로 알림을 전송합니다.', filename: 'prism-notify.yml', src: '/workflows/prism-notify.yml' },
  { key: 'pr-opened', label: 'PR 오픈', description: 'PR 생성 이벤트의 메타데이터를 수집하여 통계에 활용합니다.', filename: 'prism-pr-opened.yml', src: '/workflows/prism-pr-opened.yml' },
  { key: 'review-request-removed', label: '리뷰어 관리', description: '리뷰어 제거 이벤트의 메타데이터를 수집하여 통계에 활용합니다.', filename: 'prism-review-request-removed.yml', src: '/workflows/prism-review-request-removed.yml' },
  { key: 'comment', label: '코멘트', description: 'PR 코멘트 이벤트의 메타데이터를 수집하여 통계에 활용합니다.', filename: 'prism-comment.yml', src: '/workflows/prism-comment.yml' },
  { key: 'labeled', label: 'PR 라벨', description: 'PR 라벨 추가/제거 이벤트의 메타데이터를 수집하여 통계에 활용합니다.', filename: 'prism-labeled.yml', src: '/workflows/prism-labeled.yml' },
  { key: 'review-submitted', label: '리뷰 제출', description: '리뷰 제출 이벤트의 메타데이터를 수집하여 통계에 활용합니다.', filename: 'prism-review-submitted.yml', src: '/workflows/prism-review-submitted.yml' },
];


const copyText = async (text: string) => {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fallback
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  let success = false;
  try {
    success = document.execCommand('copy');
  } catch {
    success = false;
  }

  document.body.removeChild(textarea);
  return success;
};

type SetupSection = 'project' | 'slack' | 'github';
type SlackStatus = 'idle' | 'loading' | 'success' | 'error';

const STATS_SERVER_URL = process.env.NEXT_PUBLIC_STATS_SERVER_URL ?? 'http://localhost:8081';
const SLACK_BOT_URL = process.env.NEXT_PUBLIC_SLACK_BOT_URL ?? 'https://slack.prism.dev';
const SLACK_INSTALL_ENDPOINT = `${SLACK_BOT_URL}/slack/install`;

type SetupFlowProps = {
  onRequestMain?: () => void;
};

export default function SetupFlow({ onRequestMain }: SetupFlowProps) {
  // Use standard state instead of next/navigation hooks
  const [activeSection, setActiveSection] = useState<SetupSection>('project');
  const [alias, setAlias] = useState('');
  const [isCreating, setCreating] = useState(false);
  const [projectCreated, setProjectCreated] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');
  const copyTimerRef = useRef<number | null>(null);
  const [projectError, setProjectError] = useState('');
  const [generatedApiKey, setGeneratedApiKey] = useState('');
  const [accessToken, setAccessToken] = useState('');

  // Slack 상태 관리
  const [slackOAuthUrl, setSlackOAuthUrl] = useState('');
  const [slackStatus, setSlackStatus] = useState<SlackStatus>('idle');
  const [slackErrorMessage, setSlackErrorMessage] = useState('');

  const [isReady, setIsReady] = useState(false);
  const [githubTab, setGithubTab] = useState<GithubTab>('all');
  const [workflowScripts, setWorkflowScripts] = useState<Record<string, string>>({});

  const projectRef = useRef<HTMLDivElement>(null);
  const slackRef = useRef<HTMLDivElement>(null);
  const githubRef = useRef<HTMLDivElement>(null);
  const slackCallbackKeyRef = useRef<string | null>(null);

  // 0. YML 파일 로드
  useEffect(() => {
    Promise.all(
      githubTabs.map((t) =>
        fetch(t.src).then((r) => r.ok ? r.text() : '').then((text) => [t.key, text.trimEnd()] as const)
      )
    ).then((entries) => {
      const scripts: Record<string, string> = {};
      for (const [key, text] of entries) {
        scripts[key] = text;
      }
      setWorkflowScripts(scripts);
    });
  }, []);

  // 1. 초기 렌더링 및 토큰/API Key 로드
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);

    const match = document.cookie
      .split(';')
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith('prism_access_token='));

    if (match) {
      const [, ...valueParts] = match.split('=');
      const rawValue = valueParts.join('=');
      if (rawValue) {
        try {
          setAccessToken(decodeURIComponent(rawValue));
        } catch {
          setAccessToken(rawValue);
        }
      }
    }

    // sessionStorage에서 API key 복원 (GitHub Actions 섹션에서 표시용)
    const savedApiKey = sessionStorage.getItem('prism_api_key');
    if (savedApiKey) {
      setGeneratedApiKey(savedApiKey);
      // projectCreated는 설정하지 않아 새 프로젝트 생성 가능
    }

    return () => clearTimeout(timer);
  }, []);

  // 2. Slack OAuth Callback 처리 (Code & State 감지)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Use URLSearchParams directly since we can't use next/navigation
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    // 이미 처리했거나 코드가 없으면 리턴
    if (!code || !state || slackStatus === 'success' || slackStatus === 'loading') {
      return;
    }

    const callbackKey = `${code}::${state}`;
    if (slackCallbackKeyRef.current === callbackKey) {
      return;
    }
    slackCallbackKeyRef.current = callbackKey;

    const processSlackCallback = async () => {
      setSlackStatus('loading');
      setActiveSection('slack'); // Slack 섹션으로 UI 이동

      try {
        // 백엔드 컨트롤러: @GetMapping("/callback") public ResponseEntity<Void> callback(...)
        const callbackUrl = `${SLACK_BOT_URL}${window.location.pathname}${window.location.search}`;
        const response = await fetch(callbackUrl, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          setSlackStatus('success');
          // 성공 후 URL 파라미터 제거 (clean URL) using standard history API
          window.history.replaceState({}, '', window.location.pathname);
        } else {
          const errorText = await response.text().catch(() => '');
          console.error('Slack callback error', response.status, errorText);
          setSlackErrorMessage(`Slack 연동에 실패했습니다 (${response.status}). ${errorText}`);
          throw new Error(`Slack 연동에 실패했습니다: ${response.status} ${errorText}`);
        }
      } catch (error) {
        console.error(error);
        setSlackStatus('error');
        setSlackErrorMessage('Slack 연동 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      }
    };

    processSlackCallback();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount to check URL params

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, [generatedApiKey]);

  useEffect(() => {
    return () => {
      if (githubCopyTimerRef.current) {
        window.clearTimeout(githubCopyTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (projectError) {
      setProjectError('');
    }
  }, [alias]);


  const handleCreateProject = useCallback(async () => {
    if (!alias.trim()) {
      setProjectError('프로젝트 별칭을 입력해주세요!');
      return;
    }

    setCreating(true);
    setProjectError('');

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (accessToken) {
        headers.Authorization = accessToken;
      }

      // 1. 프로젝트 생성 요청
      const response = await fetch(`${STATS_SERVER_URL}/projects`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ name: alias.trim() })
      });

      if (!response.ok) {
        let message = '프로젝트 생성에 실패했습니다.';
        try {
          const body = await response.json();
          if (body?.message) {
            message = body.message;
          }
        } catch {
          // ignore
        }
        setProjectError(message);
        setProjectCreated(false);
        setShowApiKey(false);
        return;
      }

      const data = await response.json();
      const newApiKey = data?.apiKey ?? '';

      // 2. Slack OAuth URL 요청
      // 백엔드 컨트롤러: @GetMapping("/install")
      const installResponse = await fetch(SLACK_INSTALL_ENDPOINT, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': accessToken ? `${accessToken}` : '',
          // 백엔드에서 resolveToken 메서드로 Bearer 파싱하므로 Bearer prefix 확인
        },
      });

      if (!installResponse.ok) {
        console.error('Failed to fetch Slack OAuth URL');
        setProjectError('프로젝트는 생성되었으나 Slack 연결 정보를 불러오지 못했습니다.');
        setGeneratedApiKey(newApiKey);
        setProjectCreated(true);
        setShowApiKey(true);
        return;
      }

      const installData = await installResponse.json();
      const oauthUrl = installData?.url || `${SLACK_BOT_URL}/install`;

      setSlackOAuthUrl(oauthUrl);
      setGeneratedApiKey(newApiKey);
      setProjectCreated(true);
      setShowApiKey(true);

      // sessionStorage에 API key 저장 (리다이렉트 후에도 유지, 새 프로젝트 생성 시 덮어씀)
      if (newApiKey) {
        sessionStorage.setItem('prism_api_key', newApiKey);
      }

    } catch (error) {
      console.error(error);
      setProjectError('프로젝트 생성 중 오류가 발생했습니다.');
      setProjectCreated(false);
      setShowApiKey(false);
    } finally {
      setCreating(false);
    }
  }, [alias, accessToken]);

  const handleCopyApiKey = useCallback(async () => {
    const keyToCopy = generatedApiKey || '';
    if (!keyToCopy) {
      return;
    }
    const success = await copyText(keyToCopy);
    if (success) {
      setCopyMessage('복사되었습니다!');
    } else {
      setCopyMessage('복사에 실패했습니다.');
    }
    if (copyTimerRef.current) {
      window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = window.setTimeout(() => {
      setCopyMessage('');
      copyTimerRef.current = null;
    }, 2500);
  }, [generatedApiKey]);

  const [inviteCopyMessage, setInviteCopyMessage] = useState('');
  const [slackOAuthWarning, setSlackOAuthWarning] = useState('');

  const handleCopyInviteCommand = useCallback(async () => {
    const success = await copyText('/invite @PRism');
    setInviteCopyMessage(success ? '복사되었습니다!' : '복사에 실패했습니다.');
  }, []);

  const [githubCopyMessage, setGithubCopyMessage] = useState('');
  const githubCopyTimerRef = useRef<number | null>(null);

  const currentGithubCode = workflowScripts[githubTab] ?? '로딩 중...';
  const currentTabInfo = githubTabs.find((t) => t.key === githubTab)!;

  const handleCopyGithubCode = useCallback(async () => {
    const code = workflowScripts[githubTab] ?? '';
    if (!code) return;
    const success = await copyText(code);
    setGithubCopyMessage(success ? '복사되었습니다!' : '복사에 실패했습니다.');
    if (githubCopyTimerRef.current) {
      window.clearTimeout(githubCopyTimerRef.current);
    }
    githubCopyTimerRef.current = window.setTimeout(() => {
      setGithubCopyMessage('');
      githubCopyTimerRef.current = null;
    }, 2500);
  }, [githubTab, workflowScripts]);

  const sectionClass = useCallback(
    (name: SetupSection) => {
      const isActive = activeSection === name;
      return [
        'step-section',
        'bg-white rounded-3xl border border-indigo-100 p-8 md:p-10 relative overflow-hidden',
        isActive ? 'step-active' : 'step-inactive'
      ].join(' ');
    },
    [activeSection]
  );

  const scrollToSection = useCallback((ref: RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const buttonClass =
    'bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-8 rounded-full shadow-lg transition-all transform hover:-translate-y-0.5 flex items-center gap-2';

  const handleReturnToMain = useCallback(
    (event?: MouseEvent<HTMLAnchorElement>) => {
      if (onRequestMain) {
        event?.preventDefault();
        onRequestMain();
      }
    },
    [onRequestMain]
  );

  return (
    <div
      className="flex flex-col min-h-screen transition-opacity duration-500 ease-in-out"
      style={{
        opacity: isReady ? 1 : 0,
        visibility: isReady ? 'visible' : 'hidden'
      }}
    >
      <nav className="w-full px-8 py-6 flex justify-between items-center max-w-4xl mx-auto">
        <a href="/" className="font-bold text-xl text-indigo-900 tracking-tight flex items-center gap-2 no-underline cursor-pointer">
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
        </a>
        <div className="text-sm text-slate-500 font-medium">초기 설정 가이드</div>
      </nav>

      <main className="flex-grow w-full max-w-4xl mx-auto px-6 py-8 pb-32 space-y-8">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">시작하기</h1>
          <p className="text-slate-600">PR-ism을 사용하기 위해 프로젝트를 생성하고 연동을 완료해주세요.</p>
        </div>

        {/* --- SECTION 1: PROJECT --- */}
        <section id="section-project" className={sectionClass('project')} ref={projectRef}>
          <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500" />
          <div className="flex items-start gap-4 mb-6">
            <div
              className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg flex-shrink-0 transition-colors duration-300"
              id="badge-project"
            >
              1
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">프로젝트 생성</h2>
              <p className="text-slate-500 mt-1">PR-ism에서 관리할 프로젝트의 이름을 설정합니다.</p>
            </div>
          </div>

          <div className="space-y-8 pl-0 md:pl-14">
            <div>
              <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                프로젝트 별칭 (Alias) 입력
              </h3>
              <div className="flex gap-3 items-center">
                <input
                  value={alias}
                  onChange={(event) => setAlias(event.target.value)}
                  type="text"
                  id="project-input"
                  placeholder="예: Backend-Core, App-iOS"
                  className="flex-1 bg-white border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-3 shadow-sm disabled:bg-slate-200 disabled:text-slate-500 disabled:border-slate-300 transition-colors"
                  disabled={isCreating || projectCreated}
                />
                <button
                  id="btn-create"
                  type="button"
                  onClick={handleCreateProject}
                  disabled={isCreating || projectCreated}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg shadow-md shadow-indigo-100 transition-all flex-shrink-0 disabled:bg-slate-400 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  {isCreating ? '생성 중...' : projectCreated ? '완료' : '생성'}
                </button>
              </div>
              {projectError && (
                <p className="text-sm text-red-600 mt-2">{projectError}</p>
              )}

              {projectCreated && (
                <div className="mt-4 p-4 bg-green-50 border border-green-100 rounded-lg flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-bold text-green-800">프로젝트가 생성되었습니다!</p>
                    <p className="text-xs text-green-600 mt-0.5">아래 발급된 API Key를 확인하세요.</p>
                  </div>
                </div>
              )}

              {showApiKey && (
                <div className="mt-6 border-t border-slate-100 pt-6">
                  <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    API Key 발급
                  </h3>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      id="generated-api-key"
                      value={generatedApiKey}
                      readOnly
                      className="w-full bg-slate-800 border border-slate-700 text-emerald-400 font-mono text-sm rounded-lg p-3 pr-20 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                    />
                    <button
                      type="button"
                      onClick={handleCopyApiKey}
                      className="absolute right-1 top-1 bottom-1 bg-slate-700 hover:bg-slate-600 text-white font-medium px-3 rounded-md text-xs border border-slate-600 shadow-sm transition-all flex items-center gap-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      복사
                    </button>
                  </div>
                  {copyMessage && (
                    <p className="text-[11px] text-slate-800 font-semibold mt-2">{copyMessage}</p>
                  )}
                </div>
              )}
            </div>
            <div className="pt-6 border-t border-slate-100 flex flex-col md:flex-row justify-end items-center gap-4">
              <button
                type="button"
                className={buttonClass}
                onClick={() => {
                  setActiveSection('slack');
                  scrollToSection(slackRef);
                }}
              >
                다음 단계: Slack 봇 설치
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>
        </section>

        {/* --- SECTION 2: SLACK --- */}
        <section id="section-slack" className={sectionClass('slack')} ref={slackRef}>
          <div className="absolute top-0 left-0 w-full h-1 bg-slate-200" />
          <div className="flex items-start gap-4 mb-6">
            <div
              className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-lg flex-shrink-0 transition-colors duration-300"
              id="badge-slack"
            >
              2
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Slack 봇 설치 및 초대</h2>
              <p className="text-slate-500 mt-1">워크스페이스에 봇을 설치하고 알림을 받을 채널에 초대해주세요.</p>
            </div>
          </div>

          <div className="space-y-8 pl-0 md:pl-14">

            {/* Slack 연동 상태에 따른 UI 분기 */}
            <div>
              <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                Slack 워크스페이스에 PR-ism 봇 추가
              </h3>

              {slackStatus === 'loading' && (
                <div className="flex items-center gap-3 text-indigo-600 font-bold p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                  <svg className="animate-spin h-5 w-5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Slack 연동 확인 중입니다...
                </div>
              )}

              {slackStatus === 'error' && (
                <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-100 mb-4">
                  <p className="font-bold flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    오류 발생
                  </p>
                  <p className="text-sm mt-1">{slackErrorMessage || '연동에 실패했습니다.'}</p>
                  <button
                    onClick={() => setSlackStatus('idle')}
                    className="mt-2 text-xs bg-white border border-red-200 px-3 py-1 rounded hover:bg-red-50 font-semibold"
                  >
                    다시 시도하기
                  </button>
                </div>
              )}

              {slackStatus === 'success' && (
                <div className="p-4 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-100 flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="font-bold">Slack 연동이 완료되었습니다!</p>
                    <p className="text-sm opacity-80">원하시면 다시 설치하거나, 채널에 봇을 초대하세요.</p>
                  </div>
                </div>
              )}
              <div>
                <a
                  href={slackOAuthUrl || '#'}
                  onClick={(e) => {
                    if (!slackOAuthUrl) {
                      e.preventDefault();
                      setSlackOAuthWarning('먼저 프로젝트를 생성하여 OAuth URL을 발급받아야 합니다.');
                      setTimeout(() => setSlackOAuthWarning(''), 3000);
                    }
                  }}
                  className={`inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg shadow-md shadow-indigo-100 transition-all transform hover:-translate-y-0.5 ${!slackOAuthUrl ? 'opacity-50 cursor-not-allowed' : ''}`}
                  aria-disabled={!slackOAuthUrl}
                >
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Slack_icon_2019.svg/50px-Slack_icon_2019.svg.png"
                    alt="Slack"
                    className="w-5 h-5 brightness-0 invert"
                  />
                  Add to Slack
                </a>
                {slackOAuthWarning && (
                  <p className="text-sm text-amber-600 mt-2 flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {slackOAuthWarning}
                  </p>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                채널에 봇 초대하기
              </h3>
              <div className="flex flex-col gap-3 mb-3">
                <p className="text-sm text-slate-600">알림을 받고 싶은 채널에서 아래 명령어를 입력하세요.</p>
                <div
                  className="border border-slate-300 rounded-lg bg-white shadow-sm overflow-hidden group cursor-text"
                  onClick={handleCopyInviteCommand}
                >
                  <div className="px-3 pt-3 pb-8 text-[15px] font-sans text-slate-900">
                    /invite{' '}
                    <span className="bg-[#d2ebff] text-[#1264a3] px-0.5 rounded shadow-sm">@PRism</span>
                    <span className="animate-pulse border-r-2 border-slate-800 ml-0.5 h-4 inline-block align-middle" />
                  </div>
                </div>
                <div className="flex items-center justify-between min-h-[18px]">
                  <p className="text-[11px] text-slate-500">{inviteCopyMessage || '\u00A0'}</p>
                  <button
                    type="button"
                    onClick={handleCopyInviteCommand}
                    className="text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-indigo-600 px-3 py-1.5 rounded shadow-sm transition-all flex items-center gap-1.5"
                  >
                    명령어 복사
                  </button>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                개인 계정 연동 안내
              </h3>
              <p className="text-sm text-slate-600 mb-3">
                팀원들이 각자 슬랙에서 아래 명령어를 입력하여 Github 계정을 연동할 수 있도록 안내해주세요.
              </p>
              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-indigo-100 rounded-[4px] flex-shrink-0 flex items-center justify-center">
                    <svg width="24" height="24" viewBox="0 0 300 300" fill="none">
                      <path d="M150 40 L150 260 L250 140 Z" fill="#6366F1" stroke="#1E293B" strokeWidth="20" strokeLinejoin="round" />
                      <path d="M150 40 L50 180 L150 260 Z" fill="#FFFFFF" stroke="#1E293B" strokeWidth="20" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="font-bold text-slate-900 text-[15px]">PR-ism</span>
                      <span className="text-[10px] text-white bg-slate-400 px-1 py-[1px] rounded-[2px] font-bold uppercase tracking-wide">APP</span>
                      <span className="text-xs text-slate-500">1:25 PM</span>
                    </div>
                    <div className="text-[15px] text-slate-900 leading-relaxed">
                      반갑습니다! PR Review Assistant, PRism 입니다.
                      <br />
                      원활한 리뷰 알림을 받기 위해, 팀원분들은 아래 명령어로 깃허브 계정을 연동해주세요!
                      <br />
                      <br />
                      <code className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 font-mono text-sm">
                        /prism connect [본인의-깃허브-아이디]
                      </code>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
              <button
                type="button"
                className={buttonClass}
                onClick={() => {
                  setActiveSection('project');
                  scrollToSection(projectRef);
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
                이전 단계: 프로젝트 생성
              </button>

              <button
                type="button"
                className={buttonClass}
                onClick={() => {
                  setActiveSection('github');
                  scrollToSection(githubRef);
                }}
              >
                다음 단계: Github Actions 설정
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>
        </section>

        {/* --- SECTION 3: GITHUB --- */}
        <section id="section-github" className={sectionClass('github')} ref={githubRef}>
          <div className="absolute top-0 left-0 w-full h-1 bg-slate-200" />
          <div className="flex items-start gap-4 mb-6">
            <div
              className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-lg flex-shrink-0 transition-colors duration-300"
              id="badge-github"
            >
              3
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Github Actions 스크립트 설정</h2>
                  <p className="text-slate-500 mt-1">PR이 생성될 때마다 PR-ism에 알림을 보내도록 설정합니다.</p>
                </div>
                <button
                  type="button"
                  onClick={() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })}
                  className="hidden md:flex items-center gap-1 text-sm text-slate-600 hover:text-indigo-600 font-medium transition-colors"
                >
                  페이지 하단으로
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6 pl-0 md:pl-14">
            <p className="text-slate-600 leading-relaxed">
              프로젝트의{' '}
              <code className="text-sm bg-slate-100 px-1.5 py-0.5 rounded text-indigo-700 font-mono">.github/workflows/{currentTabInfo.filename}</code>{' '}
              경로에 아래 내용을 추가하세요.
              <br />
              아래 API Key를 Github Secrets에{' '}
              <code className="text-sm bg-slate-100 px-1.5 py-0.5 rounded text-indigo-700 font-mono">PRISM_API_KEY</code>로 등록해야 합니다.
            </p>

            {generatedApiKey && (
              <div className="border border-indigo-100 bg-indigo-50 rounded-lg p-4">
                <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  발급된 API Key
                </h3>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={generatedApiKey}
                    readOnly
                    className="w-full bg-slate-800 border border-slate-700 text-emerald-400 font-mono text-sm rounded-lg p-3 pr-20 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={handleCopyApiKey}
                    className="absolute right-1 top-1 bottom-1 bg-slate-700 hover:bg-slate-600 text-white font-medium px-3 rounded-md text-xs border border-slate-600 shadow-sm transition-all flex items-center gap-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    복사
                  </button>
                </div>
                {copyMessage && (
                  <p className="text-[11px] text-slate-800 font-semibold mt-2">{copyMessage}</p>
                )}
              </div>
            )}

            <div>
              <div className="flex flex-wrap gap-1 mb-0">
                {githubTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setGithubTab(tab.key)}
                    className={[
                      'px-4 py-2 text-sm font-medium rounded-t-lg transition-colors relative',
                      githubTab === tab.key
                        ? 'bg-[#1E293B] text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700',
                    ].join(' ')}
                  >
                    {tab.label}
                    {tab.key === 'all' && (
                      <span className="ml-1.5 text-[10px] bg-indigo-500 text-white px-1.5 py-0.5 rounded-full font-bold align-middle">
                        ALL
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 border-b-0 rounded-none px-4 py-2">
                {currentTabInfo.description}
              </p>
              <div className="relative group">
                <div className="absolute top-3 right-3 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10 flex flex-col items-end gap-1">
                  <button
                    type="button"
                    onClick={handleCopyGithubCode}
                    className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border border-white/20 px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    Copy Code
                  </button>
                  {githubCopyMessage && (
                    <span className="text-[11px] text-emerald-400 font-semibold bg-slate-800/80 backdrop-blur-sm px-2 py-1 rounded">
                      {githubCopyMessage}
                    </span>
                  )}
                </div>
                <pre className="bg-[#1E293B] text-slate-300 p-5 rounded-t-none rounded-b-xl overflow-x-auto text-sm leading-relaxed shadow-inner code-block border border-slate-700 border-t-0">
                  <code>{currentGithubCode}</code>
                </pre>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
              <button
                type="button"
                className={buttonClass}
                onClick={() => {
                  setActiveSection('slack');
                  scrollToSection(slackRef);
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
                이전 단계: Slack 봇 설치
              </button>
              <a href="/projects" className={buttonClass}>
                다음 단계: 프로젝트 목록 조회
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
