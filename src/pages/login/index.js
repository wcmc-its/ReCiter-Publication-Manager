import Login from '../../components/elements/Login/Login'
import { getSession } from "next-auth/client"
import { allowedPermissions, dropdownItemsReport } from "../../utils/constants";

export async function getServerSideProps(ctx) {
    const session = await getSession(ctx);
    let userPermissions = null;
    let personIdentifier =null;
    let userName =null;
    if (session && session.data) {
        userPermissions = JSON.parse(session.data.userRoles);
        userName = session.data.username;
        personIdentifier = userPermissions && userPermissions.length > 0 ? userPermissions[0].personIdentifier : ""
    
        if(session.data.databaseUser && session.data.databaseUser.status == 0) {
            return {
                redirect: {
                    destination: "/noaccess",
                    permanent: false,
                },
            };
        }
        else if((userPermissions && userPermissions.some(role => role.roleLabel === allowedPermissions.Curator_Self)) && userName) 
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
        if((userPermissions && userPermissions.some(role => role.roleLabel === allowedPermissions.Curator_Self)) && userName) 
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
                        destination: "/api/saml/assert?callbackUrl=/search",
                        permanent: false,
                    },
                };
        }
        
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