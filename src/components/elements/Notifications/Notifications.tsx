import React, { useEffect, useState } from "react";
import styles from './Notifications.module.css';
import appStyles from '../App/App.module.css';
import { useSelector, useDispatch, RootStateOrAny } from "react-redux";
import Loader from "../Common/Loader";
import { Form,Button } from "react-bootstrap";
import { sendNotification } from "../../../redux/actions/actions";

const Notifications = () => {
  const dispatch = useDispatch()
  
  useEffect(() => {
    
  }, [])

  const onSave = ()=>{
    sendNotification();
  }

  return (
    <div className={appStyles.mainContainer}>
      <h1 className={styles.header}>Manage Notifications</h1>
      <Form.Group className="mb-3" controlId="formBasicCheckbox">
        <Form.Check type="checkbox" label="Disable all notifications" />
      </Form.Group>

      <Form.Label className="fw-bold">Frequency</Form.Label>
      <Form.Select aria-label="Default select example" className={styles.selectFrequecy}>
        <option>Daily</option>
        <option value="1">Every 7 days</option>
        <option value="2">Every 14 days</option>
        <option value="3">Every 28 days</option>
      </Form.Select>

      <div className="mt-5">
        <p className="fw-bold">Reasons for sending a notification</p>
        <Form.Group className="mb-3" controlId="formBasicCheckbox">
          <Form.Check type="checkbox" label="A new publication has been accepted on your behalf" />
        </Form.Group>
        <Form.Group className="mb-3" controlId="formBasicCheckbox">
          <Form.Check type="checkbox" label="A new publication has been suggested" />
        </Form.Group>
        <div className={styles.nestedMenu}>
          <Form.Group className="mb-3" controlId="formBasicCheckbox">
            <Form.Check type="checkbox" label="Minimum evidence score for triggering a notification(higher scores indicate greater confidence)" />
          </Form.Group>
          <Form.Select aria-label="Default select example" className={styles.selectCount}>
            <option>7</option>
            <option value="1">One</option>
            <option value="2">Two</option>
            <option value="3">Three</option>
          </Form.Select>
        </div>
        <p className="mt-3">Emails will be sent to Email</p>
      </div>
    <Button variant="warning" className="m-2" onClick={()=>onSave()}>Save</Button>
    </div>
  )
}

export default Notifications;
