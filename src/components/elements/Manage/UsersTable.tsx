import React from 'react';
import styles from "./UsersTable.module.css";
import { useRouter } from 'next/router'
import { notificationEmail } from '../../../redux/actions/actions';
import { useDispatch } from 'react-redux';
import SplitDropdown from '../Dropdown/SplitDropdown';

const ROLE_LABELS: Record<string, string> = {
  'Superuser': 'Superuser',
  'Curator_All': 'Curator \u2014 All',
  'Curator_Self': 'Curator \u2014 Self',
  'Curator_Scoped': 'Curator \u2014 Scoped',
  'Curator_Department': 'Curator \u2014 Department',
  'Curator_Department_Delegate': 'Curator \u2014 Department Delegate',
  'Reporter_All': 'Reporter \u2014 All',
};

function parseJsonColumn(val: any): any[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return []; }
  }
  return [];
}

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

  const renderRoleCell = (user: any) => {
    const roles = user.listRoles || [];
    const personTypes = parseJsonColumn(user.scope_person_types);
    const orgUnits = parseJsonColumn(user.scope_org_units);
    const proxyIds = parseJsonColumn(user.proxy_person_ids);

    return (
      <div>
        {roles.length > 0 ? roles.map((roleObj: any, idx: number) => {
          const label = roleObj.AdminRole?.roleLabel || roleObj.listRole?.roleLabel || '';
          if (label === 'Curator_Scoped') {
            const scopeItems = [...personTypes, ...orgUnits];
            const scopeSummary = scopeItems.length > 0 ? ` (${scopeItems.join(', ')})` : '';
            return <div key={label + idx} className={styles.roleLabel}>Curator &mdash; Scoped{scopeSummary}</div>;
          }
          return <div key={label + idx} className={styles.roleLabel}>{ROLE_LABELS[label] || label}</div>;
        }) : <span className={styles.roleMuted}>&mdash;</span>}
        {proxyIds.length > 0 && (
          <div className={styles.proxyCount}>
            {proxyIds.length === 1 ? '1 proxy' : `${proxyIds.length} proxies`}
          </div>
        )}
      </div>
    );
  };

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Name</th>
          <th>Role</th>
          <th>Email</th>
          <th>Actions</th>
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
              <td>{renderRoleCell(user)}</td>
              <td><span className={styles.email}>{email || ''}</span></td>
              <td>
                <button type="button" className={styles.actionLink} onClick={() => redirectToManageUsers(userID)}>Edit</button>
                {listItems && listItems.map((item, i) => (
                  <span key={i}>
                    <span className={styles.actionDot}>·</span>
                    <button type="button" className={styles.actionLink} onClick={() => handleDropdownClick(item.title, user)}>{item.title}</button>
                  </span>
                ))}
              </td>
            </tr>
          )
        }) : (
          <tr>
            <td colSpan={4}>
              <p className={styles.noRecordsFound}>No Records Found</p>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}

export default UsersTable;
