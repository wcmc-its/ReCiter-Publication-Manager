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
import { Footer } from '../components/elements/Footer/Footer'
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { useDispatch, useSelector } from 'react-redux';
import { useSession } from 'next-auth/react';
import { fetchAdminSettingsAction } from '../redux/actions/actions';
import { useEffect } from 'react';


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
        <ReduxProvider store={store}>
        <AdminSettingsDataLoader/>  
        <Header/>
          {getLayout(<Component {...pageProps} />)}
          <Footer/>
        </ReduxProvider>
    </SessionProvider>

    
  )
  
}
