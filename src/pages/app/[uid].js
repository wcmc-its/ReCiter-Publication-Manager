import App from '../../components/elements/App/App'
import { AppLayout } from "../../components/layouts/AppLayout"
import { getSession } from "next-auth/client"
import { useRouter } from 'next/router'

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

    return {
        props: {
            session: session,
        },
    };
}

const AppPage = () => {
    const router = useRouter()
    const { uid } = router.query
    return (
        <>  
            <App uid={uid} />
        </>
    )
}

AppPage.getLayout = (page) => (
    <AppLayout>{page}</AppLayout>
);

export default AppPage;