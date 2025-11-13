import { getSession } from "next-auth/react"
import { useRouter } from 'next/router';
import { useEffect } from "react";
import { allowedPermissions } from "../utils/constants";
import { authOptions } from './api/auth/[...nextauth].jsx'
import { getServerSession } from "next-auth/next";

// function RedirectTo(to){
//     const router = useRouter();
//     useEffect(()=>{
//       router.push(to)
//     },[to])
//   }

export async function getServerSideProps(ctx) {
    console.log("context information",ctx);
    const session = await getSession(ctx);
    const session1 = await getServerSession(
        ctx.req, 
        ctx.res, 
        authOptions // <- This is the key piece of information it needs to decrypt
    );
    let userPermissions =null;
    let personIdentifier = null;
    console.log("getServerSideProps in Indix.js file****************************",session,session1);
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