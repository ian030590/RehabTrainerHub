import { resolve } from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // Use a dedicated non-incremental config for Next's internal checker. pCloud
  // may lock .next/cache while another workspace process is reading it; the
  // normal prebuild gate still type-checks the canonical tsconfig directly.
  typescript: {
    tsconfigPath: 'tsconfig.next.json',
  },
  // pCloud does not support symlink/reparse-point metadata reliably. Webpack's
  // default resolver probes every module with readlink(), which can surface
  // an EISDIR error for ordinary route files on that filesystem. Keep module
  // resolution lexical; the repository's pnpm policy already forbids
  // symlinked workspace dependencies.
  webpack(config) {
    config.resolve.symlinks = false;
    if (config.resolveLoader) config.resolveLoader.symlinks = false;
    // The pack-file cache also calls readlink() while snapshotting dependencies;
    // pCloud returns EISDIR for that probe even for regular files.
    config.cache = false;
    return config;
  },
  turbopack: {
    root: resolve(import.meta.dirname, '../..'),
  },
};

export default nextConfig;
