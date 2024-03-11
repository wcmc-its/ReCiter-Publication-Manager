import React, { useEffect, useState } from "react";
import appStyles from '../App/App.module.css';
import styles from './ManageProfile.module.css';
import { useSelector, useDispatch, RootStateOrAny } from "react-redux";
import { Form, Button, Spinner, Carousel, InputGroup } from "react-bootstrap";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import ToastContainerWrapper from '../ToastContainerWrapper/ToastContainerWrapper';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import { reciterConfig } from "../../../../config/local";
import { toast } from "react-toastify";
import { allowedPermissions } from "../../../utils/constants";
import Loader from "../Common/Loader";


const ManageProfle = () => {
    const dispatch = useDispatch()
    const {data: session, status} = useSession();
    const loading = status === "loading"
    const router = useRouter()
    const [suggested, setSuggested] = useState<boolean>(false);
    const [manualORCID, setManualORCID] = useState('');
    const [profileData, setProfileData] = useState([]);
    const [selectedOrcidValue, setSelectOrcid] = useState('');
    const [clearRadioBtns, setClearRadioBtns] = useState(false)
    const [loadProfileData, setLoadProfileData] = useState(false)
    const [errorMessage, setErrorMessage] = useState('');
    const [isCuratorSelf, setIsCuratorSelf] = useState<boolean>(false);
    const [isSuperUserORCuratorAll, SetIsSuperUserORCuratorAll] = useState<boolean>(false);
    const [isReporterAll, setIsReporterAll] = useState<boolean>(false);
    const [serverValue, setServerValue] = useState('');

    useEffect(() => {
        let userPermissions = JSON.parse(session.data.userRoles);
        let curatorSelfRole = userPermissions.some(role => role.roleLabel === allowedPermissions.Curator_Self);
        let curatorAllfRole = userPermissions.some(role => role.roleLabel === allowedPermissions.Curator_All);
        let superUserRole = userPermissions.some(role => role.roleLabel === allowedPermissions.Superuser);

        if (router.query.userId === session.data.username) {
            if (!curatorSelfRole) {
                if (superUserRole || curatorAllfRole) {
                    SetIsSuperUserORCuratorAll(true)
                } else {
                    setIsReporterAll(true)
                }
            } else {
                setIsCuratorSelf(true)
            }
        } else {
            setIsCuratorSelf(true)
        }
        let userId = null;
        //some times router query userId not updating correctly. Hence,reading the userId from window location. 
        // Will be analyzed when we upgrade the next JS and code will be removed if it is obsolete. 
        if (!router.query.userId && session.data.username)
            userId = window.location.pathname.substring(window.location.pathname.lastIndexOf('/') + 1)
        else
            userId = router.query.userId ? router.query.userId : session.data.username
        getManageProfileData(userId)
    }, [router.query.userId])

    const onSave = () => {
        let payload = {
            'personIdentifier': router.query.userId,
            'orcid': manualORCID || selectedOrcidValue,
        }
        fetch(`/api/db/admin/manageProfile/saveProfileByORCID`, {
            credentials: "same-origin",
            method: 'POST',
            headers: {
                Accept: 'application/json',
                "Content-Type": "application/json",
                'Authorization': reciterConfig.backendApiKey
            },
            body: JSON.stringify(payload)
        }).then(response => {
            if (response.status === 200) {
                toast.success("ORCID Saved Successfully", {
                    position: "top-right",
                    autoClose: 2000,
                    theme: 'colored'
                });
                getManageProfileData(router.query.userId ? router.query.userId : "")
            }
        }).then(data => {

        }).catch(error => {

        })
    }


    const onReset = () => {
        let url = `/api/db/admin/manageProfile/resetProfileORCID?personIdentifier=${router.query.userId}`;
        fetch(url, {
            credentials: "same-origin",
            method: 'DELETE',
            headers: {
                Accept: 'application/json',
                "Content-Type": "application/json",
                'Authorization': reciterConfig.backendApiKey
            },
        })
            .then(res => res.json()) // or res.json()
            .then(res => {
                toast.success("ORCID has been deleted successfully", {
                    position: "top-right",
                    autoClose: 2000,
                    theme: 'colored'
                });
                setManualORCID("");
                setSelectOrcid("");
                
            })
            .catch(error => {
                console.log(error);
            });
    }

    const getManageProfileData = (personIdentifier) => {
        setLoadProfileData(true)
        let url = `/api/db/admin/manageProfile/getORCIDProfileDataByID?personIdentifier=${personIdentifier}`
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
                    setLoadProfileData(false)
                } else if (data.message === "No data found") {
                    setLoadProfileData(false)
                } else {
                    let orcidData = data?.data || ""
                    let recentUpdatedOrcid = orcidData.find(value => value.recently_selected_orcid == value.orcid);
                    if(recentUpdatedOrcid)
                        setSelectOrcid(recentUpdatedOrcid?.recently_selected_orcid);
                    else
                       setManualORCID(orcidData && orcidData.length > 0?orcidData[0].recently_selected_orcid:""); 
                    setProfileData(orcidData);
                    setLoadProfileData(false);
                }
            })
            .catch(error => {
                setLoadProfileData(false)
                console.log(error);
            });
    }

    const onManualOrcidChange = (e) => {
        setClearRadioBtns(true);
        setSelectOrcid("");
        const value = e.target.value;
        const numericValue = value.replace(/\D/g, '');
        // Format the value into the desired pattern
        const formattedValue = formatInput(numericValue);
        if (formattedValue.length === 19) {
            // Clear the error message if the input meets the formatter length
            setErrorMessage('');
        } else {
            // Set an error message if the input does not meet the formatter length
            setErrorMessage('Please enter the value in the format ####-####-####-####');
        }

        setManualORCID(formattedValue);
    }

    const onRadioChange = (e) => {
        let orcidValue = e
        if (orcidValue == selectedOrcidValue) {
            setSelectOrcid('')
        } else {
            setSelectOrcid(orcidValue)

            setManualORCID('');
        }
        setErrorMessage('');
    }

    const formatInput = (value) => {
        // Format the value into ####-####-####-####
        const formattedValue = value
            .replace(/(\d{4})/g, '$1-') // Add a hyphen after every 4 characters
            .slice(0, 19); // Limit the length to 19 characters
        return formattedValue;
    };


    const displayORCIDDesc = (values) => {
        const {
            articleCount_accepted,
            articleCount_null,
            articleCount_rejected,
            pmids_rejected,
            pmids_null,
            pmids_accepted,
            orcid,
            personIdentifier
        } = values;

        let formattedLabel = <div className="d-flex customLabel">
            <p><a href={` https://orcid.org/${orcid}`} target="blank" rel="noreferrer"><span>{orcid}</span></a>- </p>
            {
                articleCount_accepted > 0 && <a href={pmids_accepted} target="blank" rel="noreferrer"><span> {articleCount_accepted} accepted {articleCount_null > 0 && ","}</span></a>
            }
            {
                articleCount_null > 0 && <a href={pmids_null} target="blank" rel="noreferrer"><span> {articleCount_null} suggested {articleCount_rejected > 0 && ","}</span></a>
            }
            {
                articleCount_rejected > 0 && <a href={pmids_rejected} target="blank" rel="noreferrer"> <span> {articleCount_rejected} rejected</span></a>
            }
        </div>
        return formattedLabel
    }

    return (
        <div className={appStyles.mainContainer}>
            <h1 className={styles.header}>Manage Profile</h1>
            {
                (isCuratorSelf || isSuperUserORCuratorAll) ? <>
                    <div className="pb-4">
                        <h5>ORCID</h5>
                        <p>Provide your unique <a className="textDecorationLabel" href="https://orcid.org/" target="_blank" rel="noreferrer">ORCID ID</a> to retrieve unclaimed PubMed publications. In the interests of <br />streamlining your administrative tasks, your ORCID may be shared with select authorized parties.</p>
                    </div>

                    <div className="pb-4">
                        <h6><b>Suggested ORCID</b></h6>
                        <p className="pt-3">Here are your top suggestions. This is based on how often you have accepted or rejected <br />publications associated with those ORCID values.</p>
                        <div>
                            {
                                loadProfileData ? <div className="d-flex justify-content-center align-items">  <Loader /></div>
                                    :
                                    <>
                                        {
                                            profileData && profileData.length > 0 ?
                                                <FormControl>
                                                    <RadioGroup
                                                        aria-labelledby="demo-radio-buttons-group-label"
                                                        defaultValue="female"
                                                        name="radio-buttons-group"
                                                        value={selectedOrcidValue}
                                                    >
                                                        {
                                                            profileData.map((values, i) => {
                                                                const { orcid, recent_updated_orcid } = values;
                                                                return <div className="d-flex" key={i}><FormControlLabel className="orcidLabel" key={i} value={orcid} control={<Radio onChange={() => onRadioChange(orcid)} />} label="" /><p className="customLabelForRadio">{displayORCIDDesc(values)}</p></div>
                                                            }
                                                            )
                                                        }
                                                    </RadioGroup>
                                                </FormControl> : <p><i>No available suggestions.</i></p>
                                        }
                                    </>
                            }
                        </div>
                    </div>

                    <div>
                        <h6><b>Manually add your ORCID</b></h6>
                        <p>Alternatively, you can manually enter your ORCID ID in the field below: </p>
                        <div className="width400 pb-3">
                            <InputGroup>
                                <Form.Control type="input" value={manualORCID} onChange={(e) => onManualOrcidChange(e)} className="inputORCID" placeholder="####-####-####-####"></Form.Control>
                            </InputGroup>
                            {errorMessage && <div style={{ color: 'red' }}>{errorMessage}</div>}
                        </div>
                    </div>
                    <div className="d-flex">
                        <Button variant="warning" className="m-2" onClick={() => onSave()} disabled={selectedOrcidValue == "" && manualORCID == ""}>
                            Save
                        </Button>
                        <Button variant="warning" className="m-2" onClick={() => onReset()}  >
                            Reset
                        </Button>
                    </div>
                    <ToastContainerWrapper />
                </> : (!isCuratorSelf || !isReporterAll) ? <div className="noAccessRole">
                    <p>Your user does not have the Curator Self role. To edit the Manage Profile for another user, first click on the Manage Users tab.</p>
                </div> : ""}

        </div>
    )
}


export default ManageProfle;
