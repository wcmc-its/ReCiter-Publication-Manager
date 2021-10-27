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
import { Provider } from 'react-redux'
import { useStore } from '../redux/store/store'
import type { Page } from '../../types/pages'
import { Fragment } from 'react'
import type { AppProps } from 'next/app'

// this should give a better typing
type Props = AppProps & {
  Component: Page
}

export default function App({ Component, pageProps }: Props) {
  const store = useStore(pageProps.initialReduxState)
  // Use the layout defined at the page level, if available
  const getLayout = Component.getLayout ?? ((page) => page)
  const Layout = Component.layout ?? Fragment

  return (
    <Layout>
      <Provider store={store}>
        {getLayout(<Component {...pageProps} />)}
      </Provider>
    </Layout>
  )
  
}
