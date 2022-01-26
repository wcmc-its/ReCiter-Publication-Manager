export async function getServerSideProps() {
    if(process.env.LOGIN_PROVIDER !== "SAML") {
        return {
            redirect: {
                destination: "/login",
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