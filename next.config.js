module.exports = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ 
        protocol: 'https',
        hostname: 'directory.weill.cornell.edu',
        pathname: '/**', // allows all paths on this host],
  }],
  swcMinify: true,
}
