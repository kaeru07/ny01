/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // playwright-core は内部に HTML などバンドル不可能な資産を持つため、
    // サーバー側で素の require として扱う（審査提出準備のスクショ撮影で使用）。
    serverComponentsExternalPackages: ['playwright-core'],
  },
}

export default nextConfig
