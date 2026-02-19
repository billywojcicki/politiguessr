/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Allow server-side imports of Node.js modules used in scripts/API routes
    serverComponentsExternalPackages: ["shapefile", "csv-parse"],
  },
};

export default nextConfig;
