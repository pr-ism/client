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
      <head />
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
          id="tailwind-error-guard"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
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
            `
          }}
        />
        {children}
      </body>
    </html>
  );
}
