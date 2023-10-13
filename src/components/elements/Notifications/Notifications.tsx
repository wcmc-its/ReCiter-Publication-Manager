import React, { useEffect, useState } from "react";
import styles from './Notifications.module.css';
import appStyles from '../App/App.module.css';
import { useSelector, useDispatch, RootStateOrAny } from "react-redux";
import Loader from "../Common/Loader";
import { Form,Button } from "react-bootstrap";
import { saveNotification, sendNotification,sendEmailData, disableNotificationbyID } from "../../../redux/actions/actions";
import { useSession } from "next-auth/client";
import { useRouter } from "next/router";

const Notifications = () => {
 const dispatch = useDispatch()
 const [session, loading] = useSession();
 const router = useRouter()
 const [state, setState] = useState({
  frequency: 7,
  minimumThreshold:8,
})

const identityData = useSelector((state: RootStateOrAny) => state.identityData);
const notificationEmailCarier = useSelector((state: RootStateOrAny) => state.notificationEmailCarier)
const {frequency,minimumThreshold} = state
const [formErrorsInst, setformErrInst] = useState<{[key: string]: any}>({});
const [accepted, setAccepted] = useState<boolean>(false);
const [status, setStatus] = useState<boolean>(true);
const [evidence, setEvidance] = useState<boolean>(false)
const [suggested, setSuggested] = useState<boolean>(false)
const [userId, setUserId] = useState<any>("");
const [disableAll, setDisableAll] = useState<boolean>(true);
const [email, setEmail] = useState<string>();

useEffect(()=>{
  setUserId( router.query.userId)
  if(router.query.userId === session.data.username) setEmail(session.data.email)
  else setEmail( notificationEmailCarier)
},[])

 const handleAccept = ()=>{
  setAccepted(!accepted)
 }

 const handleSuggested = ()=>{
  setSuggested(!suggested)
 }
 const handleEvidence = ()=>{
  setEvidance(!evidence)
 }
 
 const onSave = ()=>{
  if(status){
  let payload = {frequency : 0, suggested : 0 ,accepted : 0,status : 0, minimumThreshold : 0 , userId}

    dispatch(disableNotificationbyID(payload))
  }else{
  let payload = {frequency, suggested : suggested ? 1 : 0 ,accepted : accepted === true ? 1 : 0,status : status === true ? 1 : 0, minimumThreshold : evidence ? minimumThreshold : 0 , userId}
  dispatch(saveNotification(payload))
  }
 }

 const sendEmail = ()=>{
  dispatch(sendEmailData())
 }

 const handleStatus= ()=>{
  setStatus(!status);
  setState(state => ({ ...state, ["minimumThreshold"]: 0, ["frequency"]: 7 }))
  setDisableAll(!disableAll)
 }

 const handleValueChange = (field, value) => {
  if(value != '') formErrorsInst[field] = '';
  setState(state => ({ ...state, [field]: value }))
}

 return (
  <div className={appStyles.mainContainer}>
   <h1 className={styles.header}>Manage Notifications</h1>
   <Form.Group className="mb-3" controlId="formBasicCheckbox">
    <Form.Check type="checkbox" checked={status} label="Disable all notifications"   onChange={()=>handleStatus()}/>
   </Form.Group>

   <Form.Label className="fw-bold">Frequency</Form.Label>
   <Form.Select aria-label="Default select example" disabled = {disableAll} value={frequency} defaultValue={1} onChange={(e)=>handleValueChange("frequency",e.target.value)} className={styles.selectFrequecy}>
    <option value = "1">Daily</option>
    <option value="7">Every 7 days</option>
    <option value="14">Every 14 days</option>
    <option value="28">Every 28 days</option>
   </Form.Select>

   <div className="mt-5">
    <p className="fw-bold">Reasons for sending a notification</p>
    <Form.Group className="mb-3" controlId="formBasicCheckbox">
     <Form.Check type="checkbox" checked={accepted} label="A new publication has been accepted on your behalf" disabled = {disableAll} onChange={()=>handleAccept()}/>
    </Form.Group>
    <Form.Group className="mb-3" controlId="formBasicCheckbox">
     <Form.Check type="checkbox"   checked={suggested} label="A new publication has been suggested" disabled = {disableAll} onChange={()=>handleSuggested()}/>
    </Form.Group>
    <div className={styles.nestedMenu}>
     <Form.Group className="mb-3" controlId="formBasicCheckbox">
      <Form.Check type="checkbox"  checked={evidence} disabled = {disableAll} label="Minimum evidence score for triggering a notification(higher scores indicate greater confidence)" onChange={()=>handleEvidence()}/>
     </Form.Group>
     <Form.Select aria-label="Default select example" value={minimumThreshold} disabled={!evidence || disableAll} onChange={(e)=>handleValueChange("minimumThreshold",e.target.value)} className={styles.selectCount}>
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
    <p className="mt-3">Emails will be sent to {notificationEmailCarier || email}</p>
   </div>
  <Button variant="warning" className="m-2" onClick={()=>onSave()}>Save</Button>
  </div>
 )
}

export default Notifications;