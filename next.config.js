module.exports = {
  reactStrictMode: true,
  swcMinify: true,
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
