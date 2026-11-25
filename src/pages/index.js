import { getSession } from "next-auth/react"
													   
import { allowedPermissions } from "../utils/constants";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./api/auth/[...nextauth]"; 


export async function getServerSideProps(ctx) {
   try
   { 
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    let userPermissions =null;
    let personIdentifier = null;
    if(session && session.data && session?.data.userRoles)
    {  
        userPermissions = JSON.parse(session?.data?.userRoles);
         personIdentifier = userPermissions && userPermissions?.length > 0 ? userPermissions[0]?.personIdentifier : ""
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
        if (session && session?.data) {
            if (session?.data?.databaseUser && session?.data?.databaseUser?.status == 0) {
                return {
                    redirect: {
                        destination: "/noaccess",
                        permanent: false,
                    },
                };
            }
            else if (userPermissions && userPermissions?.some(role => role?.roleLabel === allowedPermissions?.Curator_Self)) {
                return {
                    redirect: {
                        destination: `/curate/${personIdentifier}`,
                        permanent: false,
                    },
                };
            } 
            else if ( userPermissions && userPermissions?.some(role => role?.roleLabel === allowedPermissions?.Curator_All || role.roleLabel === allowedPermissions.Reporter_All || role.roleLabel === allowedPermissions.Superuser)) {
			 
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
                destination: "/api/auth/saml-login?callbackUrl=/search",
                permanent: false,
            },
        };
   }  
    catch (error) {
        console.error("[INDEX:getServerSideProps]", error);
        if (process.env.NEXT_PUBLIC_LOGIN_PROVIDER !== "SAML") {
        return { redirect: { destination: "/login", permanent: false } };
    }
    }
}

export default function Home() {

    // @ts-ignore
    return <></>;
}