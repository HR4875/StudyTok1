/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // pdfjs-dist는 node 전용 canvas 모듈을 선택적으로 찾으므로 브라우저 번들에서 제외
    config.resolve.alias.canvas = false;
    return config;
  },
};
export default nextConfig;
