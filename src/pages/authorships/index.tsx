import { AppLayout } from "../../components/layouts/AppLayout"
import AuthorshipsTabs from "../../components/elements/Authorships/AuthorshipsTabs"

const AuthorshipsPage = () => {
    return (
        <>
            <AuthorshipsTabs />
        </>
    )
}

AuthorshipsPage.getLayout = (page) => (
    <AppLayout>{page}</AppLayout>
);

export default AuthorshipsPage;
