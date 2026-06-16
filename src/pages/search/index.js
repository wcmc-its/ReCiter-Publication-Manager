import Search from '../../components/elements/Search/Search'
import { AppLayout } from "../../components/layouts/AppLayout"
import { getSession } from "next-auth/client";

 export async function getServerSideProps(ctx) {
    try {
    const session = await getSession(ctx);

    if (!session || !session?.data) {
        console.log('Search page - No session or session.data, redirecting to login');
        return {
            redirect: {
                destination: "/login",
                permanent: false,
            },
        };
    }
	const userPermissions = session.data?.userRoles ? JSON.parse(session.data.userRoles) : [];
   
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