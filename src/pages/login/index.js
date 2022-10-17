import Login from '../../components/elements/Login/Login'
import { getSession } from "next-auth/client"

export async function getServerSideProps(ctx) {
    const session = await getSession(ctx);
    let userPermission = null;
    if (session && session.data) {
        userPermissions = JSON.parse(session.data.userRoles);
        let userName = session.data.username;
        let personIdentifier = userPermissions && userPermissions.length > 0 ? userPermissions[0].personIdentifier : ""
        console.log("userPermission from SAML Login***********************",userPermissions);
        if(session.data.databaseUser && session.data.databaseUser.status == 0) {
            return {
                redirect: {
                    destination: "/noaccess",
                    permanent: false,
                },
            };
        }
        else if((userPermissions.some(role => role.roleLabel === allowedPermissions.Curator_Self)) && userName) 
        {
            return {
                redirect: {
                    destination: `/api/saml/assert?callbackUrl=/curate/${personIdentifier}`,
                    permanent: false,
                },
            }; 
        }
        else
        { 
            return {
                redirect: {
                    destination: "/search",
                    permanent: false,
                },
            };
        }
    }

    if(process.env.LOGIN_PROVIDER == "SAML") {
        console.log("session from index.js line 26 ************************************",session);
       
        if((userPermissions.some(role => role.roleLabel === allowedPermissions.Curator_Self)) && userName) 
        return {
            redirect: {
                destination: `/api/saml/assert?callbackUrl=/curate/${personIdentifier}`,
                permanent: false,
            },
        }; 
        else 
            return {
                redirect: {
                    destination: "/api/saml/assert?callbackUrl=/search",
                    permanent: false,
                },
            };
        
    }

    return {
       props: {
            session: session,
        },
    };
}

const LoginPage = () => {
    return (
        <>
            <Login />
        </>
    )
}

export default LoginPage