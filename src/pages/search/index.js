import Search from '../../components/elements/Search/Search'
import { AppLayout } from "../../components/layouts/AppLayout"
import { getServerSession } from "next-auth/next";
import { authOptions } from "../api/auth/[...nextauth]"; 

 export async function getServerSideProps(ctx) {
    try {						  
    const session = await getServerSession(ctx.req,ctx.res, authOptions);

    if (!session || !session?.data) {
        console.log('Search page - No session or session.data, redirecting to login');
        return {
            redirect: {
                destination: "/login",
                permanent: false,
            },
        };
    }
    const userPermissions =typeof session.data?.userRoles === "string"? JSON.parse(session.data.userRoles): session.data?.userRoles ?? [];
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
}  catch (error) {
        console.error("[SEARCH:getServerSideProps]", error);
        return { redirect: { destination: "/login", permanent: false } };
    }

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