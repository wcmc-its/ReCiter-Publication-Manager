import React from 'react';
import Table from 'react-bootstrap/Table';
import styles from "./UsersTable.module.css";
import Image from 'next/image'
import Link from "next/link";
import { useRouter } from 'next/router'

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
          <th className={styles.tableHeadCell}>ID</th>
          <th className={styles.tableHeadCell}>PersonIdentifier</th>
          <th className={styles.tableHeadCell}>Email</th>
        </tr>
      </thead>
      <tbody>
        {
         data.length > 0 ? data.map((user, index) => {
            const {nameFirst, nameLast, userID,personIdentifier,email} = user;
            return (
              <tr key={index}>
                <td>{`${nameFirst && nameFirst != "null" ? nameFirst : "" } ${nameLast && nameLast != "null" ? nameLast : ""}`}</td>
                <td>{userID}</td>
                <td>{personIdentifier}</td>
                <td>{email}</td>
                <td>
                  <Link href={{pathname:`/admin/users/edit/${userID}`}}>
                    <div className='d-flex flex-col justify-content-center cursorStyle'>
                      <Image src="/icons/edit-svgrepo-com.svg" width={20} height={20} alt="Edit" />
                      <p className='mb-0 p-1 ' >Edit</p>
                    </div>
                  </Link>
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