import React from 'react';
import Table from 'react-bootstrap/Table';
import styles from "./UsersTable.module.css";
import Image from 'next/image'
import Link from "next/link";
import { useRouter } from 'next/router'
import { Button } from 'react-bootstrap';

interface UsersTableProps {
  data: any
}

const UsersTable:React.FC<UsersTableProps> = ({ data }) => {
  const router = useRouter();
  return (
    <Table striped bordered hover>
      <thead className={styles.tableHead}>
        <tr className={styles.tableHeadRow}>
          <th scope="col" className={styles.tableHeadCell}>Name</th>
          <th scope="col" className={styles.tableHeadCell}>Department</th>
          <th scope="col" className={styles.tableHeadCell}>Roles</th>
          <th scope="col" className={styles.tableHeadCell}>Email</th>
          <th scope="col" className={styles.tableHeadCell}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {
         data && data.length > 0 ? data.map((user, index) => {
            const {nameFirst, nameLast, userID,personIdentifier,email} = user;
            const roles = user.adminUsersRoles?.map(ur => ur.role?.roleLabel).filter(Boolean) || [];
            const personTypes = user.adminUsersPersonTypes?.map(pt => pt.personType).filter(Boolean) || [];
            const departments = user.adminUsersDepartments?.map(ud => ud.department?.departmentLabel).filter(Boolean) || [];
            return (
              <tr key={index}>
                <td><div>
                  <p className="text-primary mb-0">{`${nameFirst && nameFirst != "null" ? nameFirst : "" } ${nameLast && nameLast != "null" ? nameLast : ""}`}</p>
                  <p>person ID: {personIdentifier}</p>
                  </div>
                  </td>
                <td>{departments.join(', ')}</td>
                <td>
                  <span style={{ fontSize: '14px', fontWeight: 400 }}>
                    {roles.map((role, i) => {
                      if (role === 'Curator_Scoped') {
                        const scopeParts = [...personTypes, ...departments];
                        return (
                          <span key={i}>
                            {i > 0 ? ', ' : ''}Curator_Scoped
                            {scopeParts.length > 0 && (
                              <span style={{ fontSize: '12px', fontWeight: 600, color: '#777777' }}>
                                {' '}({scopeParts.join(', ')})
                              </span>
                            )}
                          </span>
                        );
                      }
                      return <span key={i}>{i > 0 ? ', ' : ''}{role}</span>;
                    })}
                  </span>
                </td>
                <td>{email}</td>
                <td> <div> <Button   variant="outline-dark" className='fw-bold' href={`/manageusers/${userID}`} size="sm">Manage User</Button> <Button size="sm" variant="outline-dark"  className='d-none text-light'>Manage Notifications</Button></div>
                </td>
              </tr>
            )
          }) : <tr><td colSpan={5}><p className={styles.noRecordsFound}>No Records Found</p></td></tr>
        }
      </tbody>
    </Table>
  )
}

export default UsersTable;
