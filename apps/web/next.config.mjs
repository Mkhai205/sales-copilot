/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@sales-copilot/contracts', '@sales-copilot/shared', '@sales-copilot/ai'],
  reactStrictMode: true,
};

export default nextConfig;
