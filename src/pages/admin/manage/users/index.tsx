import { AppLayout } from "../../../../components/layouts/AppLayout"
import { useSession } from "next-auth/react"
import ManageUsers from "../../../../components/elements/Manage/ManageUsers"

/* export async function getServerSideProps(ctx) {
    const session = await useSession(ctx);

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

const ManageUsersPage = () => {
    return (
        <>
            <ManageUsers />
        </>
    )
}

ManageUsersPage.getLayout = (page) => (
    <AppLayout>{page}</AppLayout>
);

export default ManageUsersPage;