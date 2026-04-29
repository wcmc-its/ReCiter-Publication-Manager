import '../../styles/globals.css'
import "bootstrap/dist/css/bootstrap.min.css"
import { Provider as ReduxProvider } from 'react-redux'
import { useStore } from '../redux/store/store'
import type { Page } from '../../types/pages'
import type { AppProps } from 'next/app'
import { Provider as SessionProvider } from "next-auth/client"
import type { NextPage } from 'next'
import type { ReactElement, ReactNode } from 'react'
// Header removed — brand is in sidebar, user info in content area
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { useDispatch, useSelector } from 'react-redux';
import { useSession } from 'next-auth/client';
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
      'Arial',
      'Helvetica',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
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

type AppPropsWithLayout = AppProps<{ session?: any; initialReduxState?: any }> & {
  Component: NextPageWithLayout
}

// This sub-component handles the logic so _app.tsx stays clean
function AdminSettingsDataLoader() {
    const dispatch = useDispatch();
    const [session] = useSession();
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
      </Head>
      <ThemeProvider theme={theme}>
        <ReduxProvider store={store}>
        <AdminSettingsDataLoader/>
          {getLayout(<Component {...(pageProps as any)} />)}
        </ReduxProvider>
      </ThemeProvider>
    </SessionProvider>
  )

}
