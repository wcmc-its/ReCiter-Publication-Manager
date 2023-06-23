import { AppLayout } from "../../components/layouts/AppLayout"
import Notifications from '../../components/elements/Notifications/Notifications'

const NotificationsPage = () => {
    return (
        <>
          <Notifications />
        </>
    )
}

NotificationsPage.getLayout = (page) => (
    <AppLayout>{page}</AppLayout>
);

export default NotificationsPage