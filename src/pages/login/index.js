import Login from '../../components/elements/Login/Login'
import { getSession } from "next-auth/client"

export async function getServerSideProps(ctx) {
    const session = await getSession(ctx);

    if (session && session.data) {
        if(session.data.databaseUser && session.data.databaseUser.status == 0) {
            return {
                redirect: {
                    destination: "/noaccess",
                    permanent: false,
                },
            };
        }
        return {
            redirect: {
                destination: "/search",
                permanent: false,
            },
        };
    }

    if(process.env.LOGIN_PROVIDER == "SAML") {
        console.log("session from index.js ************************************",session);
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