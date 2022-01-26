import { AppLayout } from "../../components/layouts/AppLayout"
import { getSession } from "next-auth/client"

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

const ReportsPage = () => {
    return (
        <>
        </>
    )
}

ReportsPage.getLayout = (page) => (
    <AppLayout>{page}</AppLayout>
);

export default ReportsPage