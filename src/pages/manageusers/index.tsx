import { AppLayout } from "../../components/layouts/AppLayout"
import ManageUsersTabs from "../../components/elements/Manage/ManageUsersTabs"

const ManageUsersPage = () => {
    return (
        <>
            <ManageUsersTabs />
        </>
    )
}

ManageUsersPage.getLayout = (page) => (
    <AppLayout>{page}</AppLayout>
);

export default ManageUsersPage;
