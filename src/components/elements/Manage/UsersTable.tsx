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
          <th className={styles.tableHeadCell}>Name</th>
          <th className={styles.tableHeadCell}>Department</th>
          <th className={styles.tableHeadCell}>Email</th>
          <th className={styles.tableHeadCell}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {
         data && data.length > 0 ? data.map((user, index) => {
            const {nameFirst, nameLast, userID,personIdentifier,email} = user;
            return (
              <tr key={index}>
                <td><div>
                  <p className="text-primary mb-0">{`${nameFirst && nameFirst != "null" ? nameFirst : "" } ${nameLast && nameLast != "null" ? nameLast : ""}`}</p>
                  <p>person ID: {personIdentifier}</p>
                  </div>
                  </td>
                <td>{""}</td>
                <td>{email}</td>
                <td> <div> <Button   variant="outline-dark" className='fw-bold' href={`/manageusers/${userID}`} size="sm">Manage User</Button> <Button size="sm" variant="outline-dark"  className='d-none text-light'>Manage Notifications</Button></div>
                </td>
              </tr>
            )
          }) : <p className={styles.noRecordsFound}>No Records Found</p>
        }
      </tbody>
    </Table>
  )
}

export default UsersTable;