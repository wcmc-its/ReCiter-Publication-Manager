import Search from '../../components/elements/Search/Search'
import { AppLayout } from "../../components/layouts/AppLayout"
import { getSession } from "next-auth/client"
import { getPermissionsFromRaw } from "../../utils/permissionUtils"

 export async function getServerSideProps(ctx) {
    const session = await getSession(ctx);

    if (!session || !session.data) {
        return {
            redirect: {
                destination: "/login",
                permanent: false,
            },
        };
    }

    const permissions = getPermissionsFromRaw(session.data.permissions);

    if (permissions.length === 0) {
        return {
            redirect: {
                destination: "/noaccess",
                permanent: false,
            },
        };
    }

    return {
        props: {
            session: session,
        },
    };
}

const SearchPage = () => {
    return (
        <>
            <Search />
        </>
    )
}

SearchPage.getLayout = (page) => (
    <AppLayout>{page}</AppLayout>
);

export default SearchPage