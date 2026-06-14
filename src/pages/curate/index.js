import CuratePublications from '../../components/elements/CuratePublications/CuratePublications'
import { AppLayout } from "../../components/layouts/AppLayout"
import { getSession } from "next-auth/client"

// The group curation surface (the multi-person People/Org/Institution/Person-Type queue)
// has been retired. Curate individuals via Find People (/search -> person -> /curate/[cwid])
// or use the Authorships review queue. Any visit to /curate redirects to Find People.
export async function getServerSideProps() {
    return {
        redirect: {
            destination: "/search",
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