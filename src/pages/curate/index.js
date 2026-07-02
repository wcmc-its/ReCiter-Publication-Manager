import CuratePublications from '../../components/elements/CuratePublications/CuratePublications'
import { AppLayout } from "../../components/layouts/AppLayout"
import { getSession } from "next-auth/client"

// The group curation surface (the multi-person People/Org/Institution/Person-Type queue)
// has been retired. A visitor who has their own profile (a Curator_Self role carrying a
// personIdentifier) is sent straight to curate themselves; everyone else goes to Find
// People to pick a person to curate.
export async function getServerSideProps(ctx) {
    const session = await getSession(ctx);
    const userRoles = session?.data?.userRoles ? JSON.parse(session.data.userRoles) : [];
    const selfRole = userRoles.find((r) => r.roleLabel === "Curator_Self" && r.personIdentifier);
    return {
        redirect: {
            destination: selfRole ? `/curate/${selfRole.personIdentifier}` : "/search",
            permanent: false,
        },
    };
}

const PublicationsPage = () => {
    return (
        <>
            <CuratePublications />
        </>
    )
}

PublicationsPage.getLayout = (page) => (
    <AppLayout>{page}</AppLayout>
);

export default PublicationsPage