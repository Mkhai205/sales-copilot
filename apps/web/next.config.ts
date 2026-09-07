import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  allowedDevOrigins: ['sales-copilot.kakadev.xyz', 'localhost'],
};

export default nextConfig;
