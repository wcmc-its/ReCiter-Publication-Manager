import Search from '../../components/elements/Search/Search'
import { AppLayout } from "../../components/layouts/AppLayout"
//import { getSession } from "next-auth/react"
import { getServerSession } from "next-auth/next";
import { authOptions } from "../api/auth/[...nextauth]"; // MUST import this

 export async function getServerSideProps(ctx) {
    console.log('Search page getServerSideProps called');
    console.log('--- Debugging Headers ---');
    console.log('Host:', ctx.req.headers.host);
    console.log('Cookie Header:', ctx.req.headers.cookie); // IS THIS LOGGING ANYTHING?
    console.log('authOptions:', authOptions);
    console.log("DEBUG - Secret used:", process.env.NEXTAUTH_SECRET ? "Exists" : "MISSING");
    console.log("DEBUG - Node Env:", process.env.NODE_ENV);

    const session = await getServerSession(ctx.req,ctx.res, authOptions);
    console.log('Search page - session exists:', session);
    const userPermissions = JSON.parse(session?.data?.userRoles);
    //console.log('Search page - session exists:', !!session);
    console.log('Search page - parsed userPermissions length:', userPermissions.length);
    if (!session || !session?.data) {
        console.log('Search page - No session or session.data, redirecting to login');
        return {
            redirect: {
                destination: "/login",
                permanent: false,
            },
        };
    }

    console.log('Search page - session.data.userRoles:', session?.data?.userRoles);
   
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