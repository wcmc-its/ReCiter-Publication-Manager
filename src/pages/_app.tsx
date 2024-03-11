// @ts-nocheck
/* import '../../styles/globals.css'
import "bootstrap/dist/css/bootstrap.min.css"
import type { AppProps } from 'next/app'
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "react-query";
import { Hydrate } from "react-query/hydration";
import { ReactQueryDevtools } from "react-query/devtools"
import type { Page } from '../../types/pages'



 

function MyApp({ Component, pageProps }: Props) {
  const [queryClient] = useState(() => new QueryClient());

    // Use the layout defined at the page level, if available
    const getLayout = Component.getLayout || ((page) => page);

    return (
        <QueryClientProvider client={queryClient}>
            <Hydrate state={pageProps.dehydratedState}>
                {getLayout(<Component {...pageProps} />)}
            </Hydrate>
            <ReactQueryDevtools />
        </QueryClientProvider>
    );
}
export default MyApp */


import '../../styles/globals.css'
import "bootstrap/dist/css/bootstrap.min.css"
import { Provider as ReduxProvider } from 'react-redux'
import { useStore } from '../redux/store/store'
import type { Page } from '../../types/pages'
import type { AppProps } from 'next/app'
import {  SessionProvider } from "next-auth/react"
import type { NextPage } from 'next'
import type { ReactElement, ReactNode } from 'react'
import Header from '../components/elements/Header/Header'
import { Footer } from '../components/elements/Footer/Footer'
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";


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

export default function App({ Component, pageProps: { session, ...pageProps } }: AppPropsWithLayout) {
  const store = useStore(pageProps.initialReduxState)
  // Use the layout defined at the page level, if available
  const getLayout = Component.getLayout ?? ((page) => page)
  

  return (
    <SessionProvider session={session} >
        <ReduxProvider store={store}>
        <Header/>
          {getLayout(<Component {...pageProps} />)}
          <Footer/>
        </ReduxProvider>
    </SessionProvider >
  )
  
}
