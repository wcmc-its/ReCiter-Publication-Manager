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
import { Fragment, useEffect } from 'react'
import type { AppProps } from 'next/app'
import { Provider } from "next-auth/client"
import type { NextPage } from 'next'
import type { ReactElement, ReactNode } from 'react'
import { useRouter } from "next/router";
import { allowedPermissions } from '../utils/constants'
import {useHistory} from "react-router-dom"


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
  const router = useRouter()
  let history = useHistory()
  // Use the layout defined at the page level, if available
  const getLayout = Component.getLayout ?? ((page) => page)
  

  useEffect(() => {
    if(router.isReady)
    {
      rbaController();
    }
  }, [router.isReady,router.pathname])

 

  const rbaController = async () => {
    let allUserRoles = sessionStorage.getItem("userRoles");
    
    const personIdentifierInQueryParam='';
  
    if(router && router.query && router.query.id)
    {
      personIdentifierInQueryParam = router.query.id;
    }
      if (allUserRoles && allUserRoles.length > 0) {
        let userRoles = allUserRoles && allUserRoles?.length > 0 && JSON.parse(allUserRoles)
        if (userRoles && userRoles.length > 0) {
          let loggedInUserInfo = userRoles[0].personIdentifier; 
          let isCuratorSelf = userRoles.some((role) => role.roleLabel === allowedPermissions.Curator_Self)
          let isSuperUser = userRoles.some((role) => role.roleLabel === allowedPermissions.Superuser)
          let isCuratorAll = userRoles.some((role) => role.roleLabel === allowedPermissions.Curator_All)
          let isReporterAll = userRoles.some((role) => role.roleLabel === allowedPermissions.Reporter_All)
          if (router?.pathname === "/curate/[id]" &&  !isCuratorAll  && !isSuperUser) 
          {
            console.log('coming to /curate/id');
              if (userRoles.length == 1 && isReporterAll  && !isCuratorSelf) {
                  router.push('/search');
              }
              else if (userRoles.length == 1 && loggedInUserInfo !==  personIdentifierInQueryParam && isCuratorSelf && !isReporterAll ) {
                  router.push('/curate/'+loggedInUserInfo);
              }
              else if (userRoles.length == 2 && loggedInUserInfo !==  personIdentifierInQueryParam && isCuratorSelf && isReporterAll ) {
                  router.push('/curate/'+loggedInUserInfo);
              }
             
          } 
          else if (router?.pathname === "/curate" && !isSuperUser && !isCuratorAll) 
          {
            if (userRoles.length == 1  && isReporterAll && !isCuratorSelf) {
              router.push("/search");
            }
            else if (userRoles.length == 1 && isCuratorSelf && !isReporterAll ) {
              router.push('/curate/'+loggedInUserInfo);
            }
            else if (userRoles.length == 2 && isCuratorSelf && isReporterAll) {
              router.push('/curate/'+loggedInUserInfo);
            }  
            
          } 
          else if (router?.pathname === "/search" && !isReporterAll && !isSuperUser && !isCuratorAll) 
          {
            if (userRoles.length == 1 && isCuratorSelf ) {
                router.push('/curate/'+loggedInUserInfo);
            }
          } 
          else if (router?.pathname === "/report" && !isReporterAll && !isSuperUser) 
          {
              if (userRoles.length == 1 && isCuratorSelf  && !isCuratorAll) {
                router.push('/curate/'+loggedInUserInfo);
              }
              else if (userRoles.length == 1 && !isCuratorSelf  && isCuratorAll) {
                router.push('/search')
              }
              else if (userRoles.length == 2 && isCuratorSelf  && isCuratorAll) {
                router.push('/curate/'+loggedInUserInfo);
              }  
          }  
          else if (router?.pathname === "/notifications" && !isSuperUser && !isCuratorSelf && !isCuratorAll) 
          {
             if (isReporterAll) {
              router.push("/search");
            }
            
          } 
          else if (router?.pathname === "/manageusers"  && !isSuperUser && !isCuratorAll) 
          {
              if (userRoles.length == 1 && isReporterAll &&  !isCuratorSelf ) 
              {
                router.push('/search');
              }
              else if (userRoles.length == 1 &&  isCuratorSelf && !isReporterAll) 
              {
                  router.push('/curate/'+loggedInUserInfo);
              }
              else if (userRoles.length == 2 && isCuratorSelf && isReporterAll) 
              {
                router.push('/curate/'+loggedInUserInfo);
              }
              //will be removed after implementing notifications functionality -mahender
              else if (userRoles.length == 3 && isCuratorSelf && isReporterAll && isCuratorAll) {
                router.push('/curate/'+loggedInUserInfo);
              }
          }
          else if ((router?.pathname === "/manageusers/add" ||router?.pathname === "/manageusers/[id]") && !isSuperUser ) 
          {
              if (userRoles.length == 1 && (isReporterAll || isCuratorAll) &&  !isCuratorSelf ) 
              {
                router.push('/search');
              }
              else if (userRoles.length == 1 &&  isCuratorSelf && !isReporterAll && !isCuratorAll) 
              {
                  router.push('/curate/'+loggedInUserInfo);
              }
              else if (userRoles.length == 2 && ((isCuratorSelf && isReporterAll) || (isCuratorSelf && isCuratorAll))) {
                router.push('/curate/'+loggedInUserInfo);
              }
              else if (userRoles.length == 2 && isCuratorAll && isReporterAll) {
                router.push('/search');
              }
              else if (userRoles.length == 3 && isCuratorSelf && isReporterAll && isCuratorAll) {
                router.push('/curate/'+loggedInUserInfo);
              }
              
          }
          
          else if (router?.pathname === "/configuration" && !isSuperUser)
          {
            if (userRoles.length == 1 && isReporterAll &&  !isCuratorSelf && !isCuratorAll) {
              router.push('/search');
            }
            else if (userRoles.length == 1 &&  isCuratorSelf && !isReporterAll  && !isCuratorAll) {
                router.push('/curate/'+loggedInUserInfo);
            }
            else if (userRoles.length == 1 &&  !isCuratorSelf && !isReporterAll  && isCuratorAll) {
              router.push('/search');
            }
            else if (userRoles.length == 2 && isCuratorSelf && isReporterAll  && !isCuratorAll) {
              router.push('/curate/'+loggedInUserInfo);
            }
            else if (userRoles.length == 2 && !isCuratorSelf && isReporterAll && isCuratorAll) {
              router.push('/search');
            }
            else if (userRoles.length == 3 && isCuratorSelf && isReporterAll && !isSuperUser && isCuratorAll) {
              router.push('/curate/'+loggedInUserInfo);
            }
          } 
        }
      }
  }

  return (
    <Provider session={pageProps.session}>
        <ReduxProvider store={store}>
          {getLayout(<Component {...pageProps} />)}
        </ReduxProvider>
    </Provider>
  )
  
}
