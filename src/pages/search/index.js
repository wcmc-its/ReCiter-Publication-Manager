import Search from '../../components/elements/Search/Search'
import { AppLayout } from "../../components/layouts/AppLayout"
import { getServerSession } from "next-auth/next"
import { authOptions } from "../api/auth/[...nextauth]"

 export async function getServerSideProps(ctx) {
    try {
        const session = await getServerSession(ctx.req, ctx.res, authOptions);

        if (!session || !session.data) {
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
    } catch (error) {
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