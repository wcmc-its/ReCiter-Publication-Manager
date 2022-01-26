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