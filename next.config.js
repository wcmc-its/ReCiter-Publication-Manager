/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  images: {
    domains: ['directory.weill.cornell.edu'],
  },
  swcMinify: true,
  publicRuntimeConfig: {
      loginProvider: process.env.LOGIN_PROVIDER,
  }
}
