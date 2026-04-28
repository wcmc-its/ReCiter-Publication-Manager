import { getSession } from "next-auth/client"
import { getCapabilities, getLandingPage } from "../utils/constants";

export async function getServerSideProps(ctx) {
    const session = await getSession(ctx);

    if (!session || !session.data) {
        // Not authenticated
        if (process.env.LOGIN_PROVIDER === "SAML") {
            return {
                redirect: {
                    destination: "/api/saml/assert?callbackUrl=/search",
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

    // Check if user is inactive (status=0)
    if (session.data.databaseUser && session.data.databaseUser.status == 0) {
        return {
            redirect: {
                destination: "/noaccess",
                permanent: false,
            },
        };
    }

    // Derive capabilities and determine landing page
    let userRoles = [];
    if (session.data.userRoles) {
        try {
            userRoles = JSON.parse(session.data.userRoles);
        } catch (e) {
            userRoles = [];
        }
    }

    const caps = getCapabilities(userRoles);
    const landing = getLandingPage(caps);

    return {
        redirect: {
            destination: landing,
            permanent: false,
        },
    };
}

export default function Home() {
    return <></>;
}
