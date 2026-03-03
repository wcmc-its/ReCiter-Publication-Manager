import Search from '../../components/elements/Search/Search'
import { AppLayout } from "../../components/layouts/AppLayout"
import { getSession } from "next-auth/react"

 export async function getServerSideProps(ctx) {
    console.log('Search page getServerSideProps called');
    const session = await getSession(ctx);
    console.log('Search page - session exists:', !!session);
    console.log('Search page - session.data exists:', !!session?.data);
    
    if (!session || !session.data) {
        console.log('Search page - No session or session.data, redirecting to login');
        return {
            redirect: {
                destination: "/login",
                permanent: false,
            },
        };
    }

    console.log('Search page - session.data.userRoles:', session.data.userRoles);
    const userPermissions = JSON.parse(session.data.userRoles);
    console.log('Search page - parsed userPermissions length:', userPermissions.length);

    if(userPermissions.length === 0) {
        console.log('Search page - No user permissions, redirecting to noaccess');
        return {
            redirect: {
                destination: "/noaccess",
                permanent: false,
            },
        };
    }

    console.log('Search page - Returning session props successfully');
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