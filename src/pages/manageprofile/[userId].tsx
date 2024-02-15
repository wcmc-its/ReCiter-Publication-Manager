import { AppLayout } from "../../components/layouts/AppLayout"
import ManageProfle from "../../components/elements/ManageProfile/ManageProfile"

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

const ManageProfilePage = () => {
    return (
        <>
            <ManageProfle />
        </>
    )
}

ManageProfilePage.getLayout = (page) => (
    <AppLayout>{page}</AppLayout>
);

export default ManageProfilePage;