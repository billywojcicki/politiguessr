/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Allow server-side imports of Node.js modules used in scripts/API routes
    serverComponentsExternalPackages: ["shapefile", "csv-parse"],
  },
  // Ensure data files are bundled into Vercel serverless functions
  outputFileTracingIncludes: {
    "/api/game": ["./data/*.json"],
    "/api/county-map": ["./data/*.json", "./data/*.geojson"],
  },
};

export default nextConfig;
