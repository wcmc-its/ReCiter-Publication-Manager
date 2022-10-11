import { getSession } from "next-auth/client"
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
    console.log("session from pages index*****************",session);
    let userPermissions ='';
    const personIdentifier = userPermissions && userPermissions.length > 0 ? userPermissions[0].personIdentifier : ""

    if(session && session.data && session.data.userRoles)  userPermissions = JSON.parse(session.data?.userRoles);

    if (process.env.LOGIN_PROVIDER !== "SAML") {
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
            
            if ( userPermissions && userPermissions.some(role => role.roleLabel === allowedPermissions.Curator_All || role.roleLabel === allowedPermissions.Reporter_All || role.roleLabel === allowedPermissions.Superuser)) {
                return {
                    redirect: {
                        destination: "/search",
                        permanent: false,
                    },
                };
            } else if (userPermissions && userPermissions.some(role => role.roleLabel === allowedPermissions.Curator_Self)) {
                return {
                    redirect: {
                        destination: `/curate/${personIdentifier}`,
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
    if (session && session.data) {
        if (session.data.databaseUser && session.data.databaseUser.status == 0) {
            return {
                redirect: {
                    destination: "/noaccess",
                    permanent: false,
                },
            };
        }

        if (userPermissions && userPermissions.some(role => role.roleLabel === allowedPermissions.Curator_All || role.roleLabel === allowedPermissions.Reporter_All || role.roleLabel === allowedPermissions.Superuser)) {
            return {
                redirect: {
                    destination: "/search",
                    permanent: false,
                },
            };
        } else if (userPermissions && userPermissions.some(role => role.roleLabel === allowedPermissions.Curator_Self)) {
            return {
                redirect: {
                    destination: `/curate/${personIdentifier}`,
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
        console.log("session from index*******************************",session);
        redirect: {
            destination: "/api/saml/assert?callbackUrl=/search",
            permanent: false,
        },
    };
}

export default function Home() {

    return <></>;
}