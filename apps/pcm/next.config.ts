import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, '../../'),
  transpilePackages: ['@jlycc/supabase', '@jlycc/permissions', '@jlycc/types'],
};

export default nextConfig;
