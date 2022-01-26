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

const SearchPage = () => {
    return (
        <>
            <AddUser />
        </>
    )
}

SearchPage.getLayout = (page) => (
    <AppLayout>{page}</AppLayout>
);

export default SearchPage