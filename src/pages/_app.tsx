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
import { useEffect } from 'react';
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
      '"DM Sans"',
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

export default function App({ Component, pageProps: { session, ...pageProps } }: AppPropsWithLayout) {
  const store = useStore(pageProps.initialReduxState)
  // Use the layout defined at the page level, if available
  const getLayout = Component.getLayout ?? ((page) => page)


  return (
    <SessionProvider session={session}>
      <Head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=Space+Grotesk:wght@500&display=swap" rel="stylesheet" />
      </Head>
      <ThemeProvider theme={theme}>
        <ReduxProvider store={store}>
        <AdminSettingsDataLoader/>
        <Header/>
          {getLayout(<Component {...pageProps} />)}
        </ReduxProvider>
      </ThemeProvider>
    </SessionProvider>
  )

}
