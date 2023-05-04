import React, { useEffect, useState } from "react";
import styles from './Notifications.module.css';
import appStyles from '../App/App.module.css';
import { useSelector, useDispatch, RootStateOrAny } from "react-redux";
import Loader from "../Common/Loader";
import { Form,Button } from "react-bootstrap";
import { saveNotification, sendNotification } from "../../../redux/actions/actions";
import { useSession } from "next-auth/client";

const Notifications = () => {
 const dispatch = useDispatch()
 const [session, loading] = useSession();
 const [state, setState] = useState({
  frequency: 1,
  minimumThreshold:8,
})

const identityData = useSelector((state: RootStateOrAny) => state.identityData);
const {frequency,minimumThreshold} = state
const [formErrorsInst, setformErrInst] = useState<{[key: string]: any}>({});
const [accepted, setAccepted] = useState<boolean>(false);
const [status, setStatus] = useState<boolean>(false);
const [evidence, setEvidance] = useState<boolean>(true)
const [userId, setUserId] = useState<string>("")

useEffect(()=>{
 setUserId( session.data.username)
},[])

 const handleAccept = ()=>{
  setAccepted(!accepted)
 }
 const handleEvidence = ()=>{
  setEvidance(!evidence)
 }
 const onSave = ()=>{
  let payload = {frequency,accepted : accepted === true ? 1 : 0,status : status === true ? 1 : 0,minimumThreshold, userId}
  dispatch(saveNotification(payload))
 }
 const handleStatus= ()=>{
  setStatus(!status)
 }
 const handleValueChange = (field, value) => {
  if(value != '') formErrorsInst[field] = '';
  setState(state => ({ ...state, [field]: value }))
}
 return (
  <div className={appStyles.mainContainer}>
   <h1 className={styles.header}>Manage Notifications</h1>
   <Form.Group className="mb-3" controlId="formBasicCheckbox">
    <Form.Check type="checkbox" label="Disable all notifications"  onChange={()=>handleStatus()}/>
   </Form.Group>

   <Form.Label className="fw-bold">Frequency</Form.Label>
   <Form.Select aria-label="Default select example" value={frequency} defaultValue={1} onChange={(e)=>handleValueChange("frequency",e.target.value)} className={styles.selectFrequecy}>
    <option value = "1">Daily</option>
    <option value="7">Every 7 days</option>
    <option value="14">Every 14 days</option>
    <option value="28">Every 28 days</option>
   </Form.Select>

   <div className="mt-5">
    <p className="fw-bold">Reasons for sending a notification</p>
    <Form.Group className="mb-3" controlId="formBasicCheckbox">
     <Form.Check type="checkbox" label="A new publication has been accepted on your behalf" onChange={()=>handleAccept()}/>
    </Form.Group>
    <Form.Group className="mb-3" controlId="formBasicCheckbox">
     <Form.Check type="checkbox" label="A new publication has been suggested" />
    </Form.Group>
    <div className={styles.nestedMenu}>
     <Form.Group className="mb-3" controlId="formBasicCheckbox">
      <Form.Check type="checkbox" label="Minimum evidence score for triggering a notification(higher scores indicate greater confidence)" onChange={()=>handleEvidence()}/>
     </Form.Group>
     <Form.Select aria-label="Default select example" value={minimumThreshold} disabled={evidence} onChange={(e)=>handleValueChange("minimumThreshold",e.target.value)} className={styles.selectCount}>
      {/* <option>7</option> */}
      <option value="10">10</option>
      <option value="9">9</option>
      <option value="8">8</option>
      <option value="7">7</option>
      <option value="6">6</option>
      <option value="5">5</option>
      <option value="4">4</option>
     </Form.Select>
    </div>
    <p className="mt-3">Emails will be sent to Email</p>
   </div>
  <Button variant="warning" className="m-2" onClick={()=>onSave()}>Save</Button>
  </div>
 )
}




export default Notifications;