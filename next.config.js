/** @type {import('next').NextConfig} */
const statsServerUrl = process.env.NEXT_PUBLIC_STATS_SERVER_URL ?? 'http://localhost:8081';
const useSlackProxy = process.env.NEXT_PUBLIC_SLACK_USE_API_PROXY !== 'false';
const slackBotProxyUrl = useSlackProxy ? (process.env.NEXT_PUBLIC_SLACK_BOT_PROXY_URL ?? 'http://127.0.0.1:8082') : null;

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  async rewrites() {
    const rules = [
      {
        source: '/oauth2/authorization/:provider*',
        destination: `${statsServerUrl}/oauth2/authorization/:provider*`
      }
    ];

    if (slackBotProxyUrl) {
      rules.push({
        source: '/api/:path*',
        destination: `${slackBotProxyUrl}/:path*`
      });
    }

    return rules;
  }
};

module.exports = nextConfig;
