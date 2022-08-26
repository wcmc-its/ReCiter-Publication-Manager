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
        </tr>
      </thead>
      <tbody>
        {
          data.map((user, index) => {
            return (
              <tr key={index}>
                <td>{`${user.nameFirst} ${user.nameLast}`}</td>
                <td>{user.userID}</td>
                <td>
                  <Link href={{pathname:`/admin/users/edit/${user.userID}`}}>
                    <div className='d-flex flex-col justify-content-center cursorStyle'>
                      <Image src="/icons/edit-svgrepo-com.svg" width={20} height={20} alt="Edit" />
                      <p className='mb-0 p-1 ' >Edit</p>
                    </div>
                  </Link>
                </td>
              </tr>
            )
          })
        }
      </tbody>
    </Table>
  )
}

export default UsersTable;