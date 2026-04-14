import { AppLayout } from "../../../../components/layouts/AppLayout"
import { getSession } from "next-auth/client"
import AddUser from '../../../../components/elements/AddUser/AddUser'

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

const AddUserPage = () => {
    return (
        <>
            <AddUser />
        </>
    )
}

AddUserPage.getLayout = (page) => (
    <AppLayout>{page}</AppLayout>
);

export default AddUserPage