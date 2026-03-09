import Search from '../../components/elements/Search/Search'
import { AppLayout } from "../../components/layouts/AppLayout"
import { getSession } from "next-auth/react"
import { authOptions } from "./api/auth/[...nextauth]";
import { getServerSession } from "next-auth/next";

 export async function getServerSideProps(ctx) {
    console.log('Search page getServerSideProps called');
    console.log('--- Debugging Headers ---');
    console.log('Host:', ctx.req.headers.host);
    console.log('Cookie Header:', ctx.req.headers.cookie); // IS THIS LOGGING ANYTHING?
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    const userPermissions = session.userRoles ? JSON.parse(session.userRoles) : JSON.parse(session?.data?.userRoles);
    console.log('Search page - session exists:', !!session);
    console.log('Search page - parsed userPermissions length:', userPermissions.length);
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
            session: JSON.parse(JSON.stringify(session)),
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