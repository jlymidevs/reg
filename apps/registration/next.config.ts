import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@jlycc/supabase', '@jlycc/permissions', '@jlycc/types'],
};

export default nextConfig;
