import { getServerSession } from "next-auth/next";
import { authOptions } from "./api/auth/[...nextauth]";
import { getCapabilities, getLandingPage } from "../utils/constants";

export async function getServerSideProps(ctx) {
    try {
        const session = await getServerSession(ctx.req, ctx.res, authOptions);

        if (!session || !session.data) {
            if (process.env.NEXT_PUBLIC_LOGIN_PROVIDER !== "SAML") {
                return { redirect: { destination: "/login", permanent: false } };
            }
            return { redirect: { destination: "/api/auth/saml-login?callbackUrl=/search", permanent: false } };
        }

        // Check inactive user
        if (session.data.databaseUser?.status == 0) {
            return { redirect: { destination: "/noaccess", permanent: false } };
        }

        // Use capability model for deterministic routing
        let userRoles = [];
        try {
            if (session.data.userRoles) {
                userRoles = JSON.parse(session.data.userRoles);
            }
        } catch (e) {
            userRoles = [];
        }

        const caps = getCapabilities(userRoles);
        const landing = getLandingPage(caps);

        return { redirect: { destination: landing, permanent: false } };
    } catch (error) {
        console.error("[INDEX:getServerSideProps]", error);
        if (process.env.NEXT_PUBLIC_LOGIN_PROVIDER !== "SAML") {
            return { redirect: { destination: "/login", permanent: false } };
        }
        return { redirect: { destination: "/api/auth/saml-login?callbackUrl=/search", permanent: false } };
    }
}

export default function Home() {
    return <></>;
}
