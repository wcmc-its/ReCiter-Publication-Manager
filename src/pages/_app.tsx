import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "react-query";
import { Hydrate } from "react-query/hydration";
import { ReactQueryDevtools } from "react-query/devtools"
import type { Page } from '../../types/pages'


// this should give a better typing
type Props = AppProps & {
  Component: Page
}
 

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
export default MyApp
