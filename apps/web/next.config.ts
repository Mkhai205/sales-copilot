import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  allowedDevOrigins: ['app-sales-copilot.kakadev.xyz', 'localhost:3000'],
};

export default nextConfig;
