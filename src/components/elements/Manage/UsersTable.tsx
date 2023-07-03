import React from 'react';
import Table from 'react-bootstrap/Table';
import styles from "./UsersTable.module.css";
import Image from 'next/image'
import Link from "next/link";
import { useRouter } from 'next/router'
import { Button } from 'react-bootstrap';
import { sendNotification } from '../../../redux/actions/actions';

interface UsersTableProps {
  data: any,
  onSendNotifications: () => void,
  nameOrcwidLabel?:string
}

const UsersTable:React.FC<UsersTableProps> = ({ data, onSendNotifications,nameOrcwidLabel }) => {
  const router = useRouter();

  const onClicked = ()=>{
    sendNotification()
  }


  return (
    <Table striped hover>
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
          const {nameFirst, nameLast, userID,personIdentifier,email, department, primaryOrganizationalUnit} = user;
            return (
              <tr key={index}>
                <td><div>
                  <p className="text-primary mb-0">{`${nameFirst || "" } ${nameLast || ""}`}</p>
                  <p className="mb-0">{primaryOrganizationalUnit || ""}</p>
                  <p className="mb-0">{nameOrcwidLabel || "Person ID "}: {personIdentifier || ""}</p>
                  </div>
                  </td>
                <td>{department || ""}</td>
                <td>{email || ""}</td>
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