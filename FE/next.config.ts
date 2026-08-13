import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // BE 워크스페이스는 빌드 산출물 없이 TS 소스를 그대로 내보낸다.
  transpilePackages: ["@railhub/be"],
};

export default nextConfig;
