import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: true,
  basePath: '/exam-fsb',
  assetPrefix: '/exam-fsb/',
};

export default nextConfig;
