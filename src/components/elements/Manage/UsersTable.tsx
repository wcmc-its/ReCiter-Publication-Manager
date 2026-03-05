import React from 'react';
import styles from "./UsersTable.module.css";
import { useRouter } from 'next/router'
import { notificationEmail } from '../../../redux/actions/actions';
import { useDispatch } from 'react-redux';
import SplitDropdown from '../Dropdown/SplitDropdown';

interface UsersTableProps {
  data: any,
  onSendNotifications: () => void,
  nameOrcwidLabel?:string,
  isVisibleNotification?:boolean
}

const UsersTable:React.FC<UsersTableProps> = ({ data, onSendNotifications, nameOrcwidLabel, isVisibleNotification }) => {
  const router = useRouter();
  const dispatch = useDispatch();

  const redirectToManageUsers = (userID) => {
    router.push(`/manageusers/${userID}`)
  }

  const handleDropdownClick = (title: string, user: any) => {
    if (title === 'Manage Profile') {
      router.push(`/manageprofile/${user.personIdentifier}`)
    } else if (title === 'Manage Notifications') {
      dispatch(notificationEmail({ email: user.email, userName: user.nameFirst }));
      router.push(`/notifications/${user.personIdentifier}`)
    }
  }

  const listItems = isVisibleNotification
    ? [{ title: 'Manage Profile', to: '' }, { title: 'Manage Notifications', to: '' }]
    : [{ title: 'Manage Profile', to: '' }];

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th style={{ textAlign: 'right' }}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {data && data.length > 0 ? data.map((user, index) => {
          const { nameFirst, nameLast, userID, personIdentifier, email, department, primaryOrganizationalUnit } = user;
          return (
            <tr key={index}>
              <td>
                <div className={styles.personName}>{`${nameFirst || ''} ${nameLast || ''}`}</div>
                {(primaryOrganizationalUnit || department) && (
                  <div className={styles.personDept}>{primaryOrganizationalUnit || department}</div>
                )}
                <div className={styles.personId}>
                  <span className={styles.idLabel}>{nameOrcwidLabel || 'CWID'}:</span> {personIdentifier || ''}
                </div>
              </td>
              <td><span className={styles.email}>{email || ''}</span></td>
              <td style={{ textAlign: 'right' }}>
                <SplitDropdown
                  title="Manage User"
                  onDropDownClick={() => redirectToManageUsers(userID)}
                  id={`manage-user_${userID}`}
                  listItems={listItems}
                  secondary={true}
                  onClick={(title) => handleDropdownClick(title, user)}
                />
              </td>
            </tr>
          )
        }) : (
          <tr>
            <td colSpan={3}>
              <p className={styles.noRecordsFound}>No Records Found</p>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}

export default UsersTable;
