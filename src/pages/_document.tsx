import Document, { Html, Head, Main, NextScript } from 'next/document'

// Pages-Router custom Document.
// Webfonts are loaded here via a plain Google Fonts <link> rather than next/font:
// package.json pins Next ^12.2.5 while node_modules currently resolves Next 14.x,
// so next/font would break on a clean reinstall to the pin. A <link> is stable
// across both. Inter is used for both body (--font-sans) and display (--font-display).
// Do not add <title> or meta charset here — those are owned by _app.tsx / per-page Head.
export default class MyDocument extends Document {
  render() {
    return (
      <Html lang="en">
        <Head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link
            rel="preconnect"
            href="https://fonts.gstatic.com"
            crossOrigin="anonymous"
          />
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}
