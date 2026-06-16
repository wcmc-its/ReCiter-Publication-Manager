module.exports = {
  reactStrictMode: true,
  swcMinify: true,
  eslint: {
    // Don't fail builds on lint errors. Pre-existing a11y issues across
    // restored v1.0 components are tracked separately.
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { 
        protocol: 'https',
        hostname: 'directory.weill.cornell.edu',
        pathname: '/**', // allows all paths on this host],
      },
    ],
  }
  
}
