import { AppLayout } from "../../../../components/layouts/AppLayout"
import { useSession } from "next-auth/react"
import AdminSettings from "../../../../components/elements/Manage/AdminSettings"

const AdminSettingsPage = () => {
    return (
        <>
            <AdminSettings/>
        </>
    )
}

AdminSettingsPage.getLayout = (page) => (
    <AppLayout>{page}</AppLayout>
);

export default AdminSettingsPage;