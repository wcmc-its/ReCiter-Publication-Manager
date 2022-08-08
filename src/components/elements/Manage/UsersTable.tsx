import React from 'react';
import Table from 'react-bootstrap/Table';
import styles from "./UsersTable.module.css";
import Image from 'next/image'

interface UsersTableProps {
  data: any
}

const UsersTable:React.FC<UsersTableProps> = ({ data }) => {
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
          data.map((user) => {
            return (
              <tr>
                <td>{`${user.nameFirst} ${user.nameLast}`}</td>
                <td>{user.userID}</td>
                <td><img src="" alt="Edit" /></td>
              </tr>
            )
          })
        }
      </tbody>
    </Table>
  )
}

export default UsersTable;