import { resolve } from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: resolve(import.meta.dirname, '../..'),
  },
};

export default nextConfig;
