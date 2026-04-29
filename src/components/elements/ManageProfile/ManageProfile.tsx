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


const ManageProfile = () => {
    const dispatch = useDispatch()
    const [session, loading] = useSession();
    const router = useRouter()
    const [suggested, setSuggested] = useState<boolean>(false);
    const [manualORCID, setManualORCID] = useState("")

    useEffect(() => {
        if (!session) return;

        let userId = null;
        // Sometimes router query userId does not update correctly.
        // Reading the userId from window location as a fallback.
        if (!router.query.userId && session.data.username)
            userId = window.location.pathname.substring(window.location.pathname.lastIndexOf('/') + 1)
        else
            userId = router.query.userId ? router.query.userId : session.data.username
        getManageProfileData(userId)
    }, [session, router.query.userId])

    const onSave = () => {
    }

    const getManageProfileData = (personIdentifier) => {
        let url = `/api/db/admin/manageProfile/getORCIDProfileDataByID?personIdentifier=${personIdentifier || ""}`
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
                    // No profile data yet
                } else {
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
            <h1>Manage Profile</h1>
            <div className="pb-4">
                <h5>ORCID</h5>
                <p>Provide your unique ORCID ID to retrieve unclaimed PubMed publications. In the interests of streamlining your administrative tasks, your ORCID may be shared with select authorized parties.</p>
            </div>

            <div className="pb-4">
                <h6>Suggested ORCID</h6>
                <p className="pt-3">Here are your top suggestions. This is based on how often you have accepted or rejected publications associated with those ORCID values.</p>
                <div>
                    <FormControl>
                        <RadioGroup
                            aria-labelledby="orcid-suggestions-label"
                            defaultValue="female"
                            name="orcid-suggestions"
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
                <p>Alternatively, you can manually enter your ORCID ID in the field below: </p>
                <div className="width400 pb-3">
                    <InputGroup>
                        <Form.Control
                            type="input"
                            value={manualORCID}
                            onChange={(e) => setManualORCID(e.target.value)}
                            aria-label="ORCID ID"
                        />
                    </InputGroup>
                </div>
            </div>
            <div className="d-flex">
                <Button variant="warning" className="m-2" onClick={() => onSave()}>
                    Save
                </Button>
                <Button variant="warning" className="m-2" onClick={() => onSave()}>
                    Reset
                </Button>
            </div>
        </div>
    )
}

export default ManageProfile;
