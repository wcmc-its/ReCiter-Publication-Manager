import { getSession } from "next-auth/client"
export async function getServerSideProps(ctx) {
    const session = await getSession(ctx);
    if(process.env.LOGIN_PROVIDER !== "SAML") {
        //Redirect to search after login
        if(session && session.data) {
            return {
                redirect: {
                    destination: "/search",
                    permanent: false,
                },
            };
        }
        return {
            redirect: {
                destination: "/login",
                permanent: false,
            },
        };
    }
    //Redirect to search after login
    if(session && session.data) {
        return {
            redirect: {
                destination: "/search",
                permanent: false,
            },
        };
    }

    return {
        redirect: {
            destination: "/api/saml/assert?callbackUrl=/search",
            permanent: false,
        },
    };
}

export default function Home() {
    return <></>;
}