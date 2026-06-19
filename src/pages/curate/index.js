import CuratePublications from '../../components/elements/CuratePublications/CuratePublications'
import { AppLayout } from "../../components/layouts/AppLayout"
import { getSession } from "next-auth/react"

/* export async function getServerSideProps(ctx) {
    const session = await getSession(ctx);

    if (!session || !session.data) {
        return {
            redirect: {
                destination: "/login",
                permanent: false,
            },
        };
    }

    return {
        props: {
            session: session,
        },
    };
} */

const PublicationsPage = () => {
    return (
        <>
            <CuratePublications />
        </>
    )
}

PublicationsPage.getLayout = (page) => (
    <AppLayout>{page}</AppLayout>
);

export default PublicationsPage