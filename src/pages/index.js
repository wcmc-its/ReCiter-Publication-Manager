import { getSession } from "next-auth/react"
import { useRouter } from 'next/router';
import { useEffect } from "react";
import { allowedPermissions } from "../utils/constants";


// function RedirectTo(to){
//     const router = useRouter();
//     useEffect(()=>{
//       router.push(to)
//     },[to])
//   }

export async function getServerSideProps(ctx) {
    const session = await getSession(ctx);
    let userPermissions =null;
    let personIdentifier = null;
    console.log("getServerSideProps in Indix.js file****************************");
    if(session && session.data && session.data.userRoles)
    {  
        userPermissions = JSON.parse(session.data?.userRoles);
         personIdentifier = userPermissions && userPermissions.length > 0 ? userPermissions[0].personIdentifier : ""
    }
    if (process.env.NEXT_PUBLIC_LOGIN_PROVIDER !== "SAML") {
        //Redirect to search after login
        if (session && session.data) {
            if (session.data.databaseUser && session.data.databaseUser.status == 0) {
                return {
                    redirect: {
                        destination: "/noaccess",
                        permanent: false,
                    },
                };
            }
            else if (userPermissions && userPermissions.some(role => role.roleLabel === allowedPermissions.Curator_Self)) {
                return {
                    redirect: {
                        destination: `/curate/${personIdentifier}`,
                        permanent: false,
                    },
                };
            } 
            else if ( userPermissions && userPermissions.some(role => role.roleLabel === allowedPermissions.Curator_All || role.roleLabel === allowedPermissions.Reporter_All || role.roleLabel === allowedPermissions.Superuser)) {
                return {
                    redirect: {
                        destination: "/search",
                        permanent: false,
                    },
                };
            } else {
                return {
                    redirect: {
                        destination: "/noaccess",
                        permanent: false,
                    },
                };
            }
        }

        return {
            redirect: {
                destination: "/login",
                permanent: false,
            },
        };
    }
    //Redirect to search after login
    console.log("session and its data***********************:",session, session?.data);
    if (session && session.data) {
        if (session.data.databaseUser && session.data.databaseUser.status == 0) {
            return {
                redirect: {
                    destination: "/noaccess",
                    permanent: false,
                },
            };
        }
        else if (userPermissions && userPermissions.some(role => role.roleLabel === allowedPermissions.Curator_Self)) {
            return {
                redirect: {
                    destination: `/curate/${personIdentifier}`,
                    permanent: false,
                },
            };
        }
        else if (userPermissions && userPermissions.some(role => role.roleLabel === allowedPermissions.Curator_All || role.roleLabel === allowedPermissions.Reporter_All || role.roleLabel === allowedPermissions.Superuser)) 
        {
            return {
                redirect: {
                    destination: "/search",
                    permanent: false,
                },
            };
        }  else {
            return {
                redirect: {
                    destination: "/noaccess",
                    permanent: false,
                },
            };
        }
    }
    if (!session || !session.data) {
    return {
        redirect: {
            destination: "/api/auth/saml-login?callbackUrl=/search", // Use your START route
            permanent: false,
        },
    };
}
}

export default function Home() {

    return <></>;
}