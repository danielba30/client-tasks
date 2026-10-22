import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "10mb" }, // Excel imports
  },
  serverExternalPackages: ["exceljs"],
};

export default nextConfig;
