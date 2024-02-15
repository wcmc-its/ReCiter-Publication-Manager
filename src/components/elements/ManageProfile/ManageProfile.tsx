import React, { useEffect, useState } from "react";
import appStyles from '../App/App.module.css';
import styles from './ManageProfile.module.css';
import { useSelector, useDispatch, RootStateOrAny } from "react-redux";
import { Form, Button, Spinner, Carousel, InputGroup } from "react-bootstrap";
import { useSession } from "next-auth/client";
import { useRouter } from "next/router";
import ToastContainerWrapper from '../ToastContainerWrapper/ToastContainerWrapper';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import { reciterConfig } from "../../../../config/local";
import { toast } from "react-toastify";
import { allowedPermissions } from "../../../utils/constants";





const ManageProfle = () => {
    const dispatch = useDispatch()
    const [session, loading] = useSession();
    const router = useRouter()
    const [suggested, setSuggested] = useState<boolean>(false);
    const [manualORCID, setManualORCID] = useState("")

    useEffect(() => {
        let userPermissions = JSON.parse(session.data.userRoles);
        let curatorSelfRole = userPermissions.some(role => role.roleLabel === allowedPermissions.Curator_Self);
        let curatorAllfRole = userPermissions.some(role => role.roleLabel === allowedPermissions.Curator_All);
        let superUserRole = userPermissions.some(role => role.roleLabel === allowedPermissions.Superuser);
        // if(router.query.userId === session.data.username ){
        //     if (!curatorSelfRole) {
        //       if (superUserRole || curatorAllfRole) {
        //         SetIsSuperUserORCuratorAll(true)
        //       } else {
        //         setIsReporterAll(true)
        //       }
        //     } else {
        //       setIsCuratorSelf(true)
        //     }
        //   }else{
        //     setIsCuratorSelf(true)
        //   }

          let userId = null;
          //some times router query userId not updating correctly. Hence,reading the userId from window location. 
          // Will be analyzed when we upgrade the next JS and code will be removed if it is obsolete. 
          if(!router.query.userId && session.data.username)
               userId = window.location.pathname.substring(window.location.pathname.lastIndexOf('/')+1)
          else
             userId = router.query.userId ? router.query.userId : session.data.username
        getManageProfileData(userId)
    }, [])

    const onSave = () => {
    }
    const getManageProfileData = (personIdentifier) => {
        let url = `/api/db/admin/manageProfile/getProfileDataByID?personIdentifier=${"sfs2002" || ""}`
        fetch(url, {
            credentials: "same-origin",
            method: 'GET',
            headers: {
                Accept: 'application/json',
                "Content-Type": "application/json",
                'Authorization': reciterConfig.backendApiKey
            },
        }).then(response => response.json())
            .then(data => {
                if (data.message === "User does not exist") {

                    toast.error("User does not exist", {
                        position: "top-right",
                        autoClose: 2000,
                        theme: 'colored'
                    });
                } else if (data.message === "No data found") {

                } else {
                    // const { minimumThreshold, suggested, accepted, frequency, email, userID } = data;
                    console.log("data", data)
                }
            })
            .catch(error => {
                console.log(error)
            });
    }

    const handleValueChange = () => {
        setSuggested(!suggested)
    }

    return (
        <div className={appStyles.mainContainer}>
            <h1 className={styles.header}>Manage Profile</h1>
            <div className="pb-4">
                <h5>ORCID</h5>
                <p>Provide your unique ORCID ID to retrive unclaimed PubMed publications. In the intrests of streamlining your adminstrative tasks, your ODCID may be shared with select authorized parties.</p>
            </div>

            <div className="pb-4">
                <h6>Suggested ORCID</h6>
                <p className="pt-3">Here are your top suggestions. this is based on how often you have accepted or rejected publications associated with those ORCID values.</p>
                <div>

                    <FormControl>
                        <RadioGroup
                            aria-labelledby="demo-radio-buttons-group-label"
                            defaultValue="female"
                            name="radio-buttons-group"
                        >
                            <FormControlLabel value="ORCID1" control={<Radio />} label="ORCID 1 accepted 0 null 0" />
                            <FormControlLabel value="ORCID2" control={<Radio />} label="ORCID 2 accepted 0 null 0" />
                            <FormControlLabel value="ORCID3" control={<Radio />} label="ORCID 3 accepted 0 null 0" />
                            <FormControlLabel value="ORCID4" control={<Radio />} label="ORCID 4 accepted 0 null 0" />
                        </RadioGroup>
                    </FormControl>
                </div>
            </div>

            <div>
                <h6>Manually add your ORCID</h6>
                <p>Alternatively, you can manuvally enter your ORCID ID in the field below: </p>
                <div className="width400 pb-3">
                    <InputGroup>
                        <Form.Control type="input" value={manualORCID} onChange={(e) => setManualORCID(e.target.value)} className="inputORCID"></Form.Control>
                    </InputGroup>
                </div>
            </div>
            <div className="d-flex">
                <Button variant="warning" className="m-2" onClick={() => onSave()}  >
                    Save
                </Button>
                <Button variant="warning" className="m-2" onClick={() => onSave()}  >
                    Reset
                </Button>
            </div>
        </div>
    )
}


export default ManageProfle;
