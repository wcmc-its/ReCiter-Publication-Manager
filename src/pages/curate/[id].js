import CurateIndividual from "../../components/elements/CurateIndividual/CurateIndividual"
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

const AppPage = () => {
    return (
        <>
          <CurateIndividual />
        </>
    )
}

AppPage.getLayout = (page) => (
    <AppLayout>{page}</AppLayout>
);

export default AppPage