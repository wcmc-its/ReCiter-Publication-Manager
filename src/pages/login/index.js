import Login from '../../components/elements/Login/Login'
import { getSession } from "next-auth/client"

export async function getServerSideProps(ctx) {
    const session = await getSession(ctx);

    if (session && session.data) {
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