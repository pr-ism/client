import './globals.css';
import Script from 'next/script';

export const metadata = {
  title: 'PR-ism',
  description: 'PR-ism 초기 설정과 로그인 플로우',
  icons: {
    icon: '/favicon.ico'
  }
};

const tailwindConfig = {
  theme: {
    extend: {
      fontFamily: {
        pretendard: ['Pretendard', 'sans-serif']
      }
    }
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>

        <style dangerouslySetInnerHTML={{ __html: `body:not(.tw-ready){opacity:0!important}body.tw-ready{opacity:1;transition:opacity .15s ease-in}` }} />
      </head>
      <body className="bg-[#EEF2FF] text-slate-800 min-h-screen flex flex-col font-pretendard">
        <Script
          id="tailwind-config"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.tailwind = window.tailwind || {};
              window.tailwind.config = ${JSON.stringify(tailwindConfig)};
            `
          }}
        />
        <Script src="https://cdn.tailwindcss.com" strategy="beforeInteractive" />
        <Script
          id="tailwind-ready"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function waitForTailwind(){
                var styles=document.querySelectorAll('style');
                for(var i=0;i<styles.length;i++){
                  if(styles[i].textContent&&styles[i].textContent.indexOf('--tw-')!==-1){
                    document.body.classList.add('tw-ready');return;
                  }
                }
                requestAnimationFrame(waitForTailwind);
              })();
              window.addEventListener(
                'error',
                function (event) {
                  if (
                    event.target &&
                    event.target.tagName === 'LINK' &&
                    typeof event.target.href === 'string' &&
                    event.target.href.includes('cdn.tailwindcss.com')
                  ) {
                    event.preventDefault();
                  }
                },
                true
              );
              // 안전장치: 2초 후에도 감지 못하면 강제 표시
              setTimeout(function(){document.body.classList.add('tw-ready')},2000);
            `
          }}
        />
        {children}
      </body>
    </html>
  );
}
