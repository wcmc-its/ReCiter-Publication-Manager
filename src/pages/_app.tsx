import '../../styles/globals.css'
import "bootstrap/dist/css/bootstrap.min.css"
import { Provider as ReduxProvider } from 'react-redux'
import { useStore } from '../redux/store/store'
import type { Page } from '../../types/pages'
import type { AppProps } from 'next/app'
import { SessionProvider } from "next-auth/react"
import type { NextPage } from 'next'
import type { ReactElement, ReactNode } from 'react'
import Header from '../components/elements/Header/Header'
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { useDispatch, useSelector } from 'react-redux';
import { useSession } from 'next-auth/react';
import { fetchAdminSettingsAction } from '../redux/actions/actions';
import { Component, useEffect } from 'react';
import ErrorFallback from '../components/elements/Error/Error';
import { reportError } from '../utils/reportError';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import Head from 'next/head';

const theme = createTheme({
  palette: {
    primary: {
      main: '#b31b1b',
      dark: '#8c1515',
      light: '#f5e6e6',
    },
  },
  typography: {
    fontFamily: [
      '"Inter"',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
  },
  shape: {
    borderRadius: 6,
  },
});


// this should give a better typing
type Props = AppProps & {
  Component: Page
}

type NextPageWithLayout = NextPage & {
  getLayout?: (page: ReactElement) => ReactNode
}

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout
}

// This sub-component handles the logic so _app.tsx stays clean
function AdminSettingsDataLoader() {
    const dispatch = useDispatch();
    const { data: session } = useSession();
    const adminSettings = useSelector((state: any) => state.updatedAdminSettings || []);
    useEffect(() => {
        // If we have a session but NO settings in Redux, fetch them!
        if (session && (!adminSettings || adminSettings.length === 0)) {
            dispatch(fetchAdminSettingsAction());
        }
    }, [session, adminSettings, dispatch]);

    return null;
}

// Keeps a render throw from blanking the whole app, and stamps the incident with an
// id the user can quote and support can grep for in the pod log.
class RenderErrorBoundary extends Component<{ children: ReactNode }, { ref: string }> {
  state = { ref: '' };

  static getDerivedStateFromError() {
    // ponytail: 8-char ref is enough to grep one pod log; use a real trace id if this ever spans services.
    const ref = (globalThis.crypto?.randomUUID?.() || String(performance.now()).replace('.', '').padEnd(8, '0')).slice(0, 8).toUpperCase();
    return { ref };
  }

  componentDidCatch(error: any) {
    reportError("ERR-0500", `Render crash ${this.state.ref}: ${error?.message || 'unknown'}`, error);
  }

  render() {
    if (!this.state.ref) return this.props.children;
    return (
      <>
        {/* 500: a render crash is a server-error-class failure, so it gets the danger
            colour rather than the neutral one a 404 uses. */}
        <ErrorFallback statusCode={500} />
        <p style={{ position: 'fixed', bottom: '16px', left: 0, right: 0, textAlign: 'center', color: '#6c757d', fontSize: '14px' }}>
          Reference {this.state.ref} — please include this when you report the problem.{' '}
          {/* Plain anchor, not next/link: the boundary never resets on a soft nav, and the
              nav lives inside it, so the only way out is a full document load. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/">Reload Publication Manager</a>
        </p>
      </>
    );
  }
}

export default function App({ Component, pageProps: { session, ...pageProps } }: AppPropsWithLayout) {
  const store = useStore(pageProps.initialReduxState)
  // Use the layout defined at the page level, if available
  const getLayout = Component.getLayout ?? ((page) => page)


  return (
    <SessionProvider session={session}>
      <Head>
        {/* WCM favicon (red shield) — ico + 32px png + apple-touch, modeled on CViche */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>
      <ThemeProvider theme={theme}>
        <ReduxProvider store={store}>
        <AdminSettingsDataLoader/>
        <Header/>
          <RenderErrorBoundary>
            {getLayout(<Component {...pageProps} />)}
          </RenderErrorBoundary>
        </ReduxProvider>
      </ThemeProvider>
    </SessionProvider>
  )

}
