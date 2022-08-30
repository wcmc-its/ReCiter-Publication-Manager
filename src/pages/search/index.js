import Search from '../../components/elements/Search/Search'
import { AppLayout } from "../../components/layouts/AppLayout"
import { getSession } from "next-auth/client"

 export async function getServerSideProps(ctx) {
    const session = await getSession(ctx);
    const userPermissions = JSON.parse(session.data?.userRoles);

    // if (!session || !session.data) {
    //     return {
    //         redirect: {
    //             destination: "/login",
    //             permanent: false,
    //         },
    //     };
    // }

    if(userPermissions.length === 0) {
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