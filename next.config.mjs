/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config) => {
    config.externals.push('pino-pretty')
    return config
  },
}

export default nextConfig
