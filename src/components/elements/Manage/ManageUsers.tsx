import appStyles from '../App/App.module.css';
import styles from "./ManagerUsers.module.css";
import { PageHeader } from '../Common/PageHeader';

const ManageUsers = () => {
  return (
    <div className={appStyles.mainContainer}>
      <PageHeader label="Manage Users" />
    </div>
  )
}

export default ManageUsers;