module.exports = {
  reactStrictMode: true,
  // The commit being built, so a stale tab (window.__NEXT_DATA__.buildId) names its code. null = Next's own random id.
  generateBuildId: () => process.env.GIT_SHA || null,
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
