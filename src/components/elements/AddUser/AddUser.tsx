import React, { useState, FunctionComponent, useEffect } from "react"
import { Form, Row, Col, Button, Container } from 'react-bootstrap';
import Autocomplete from '@mui/material/Autocomplete';
import { useSelector, useDispatch, RootStateOrAny } from "react-redux";
import { styled } from '@mui/material/styles';
import styles from './AddUser.module.css';
import Loader from '../Common/Loader';
import TextField from '@mui/material/TextField';
import { createAdminUser, createORupdateUserIDAction, fetchUserInfoByID} from "../../../redux/actions/actions";
import { useRouter } from "next/router";
import ToastContainerWrapper from '../ToastContainerWrapper/ToastContainerWrapper';
import { PageHeader } from "../Common/PageHeader";


interface FuncProps {
    onAccept(id: number): void,
    onReject(id: number): void,
    item: any
}
type  formErrors = {[key: string]: any};

const AddUser: FunctionComponent<FuncProps> = (props) => {

    //Store Data
    const adminDepartments = useSelector((state: RootStateOrAny) => state.AllAdminDepatments);
    const allAdminRoles = useSelector((state: RootStateOrAny) => state.AllAdminRoles);

    const [state, setState] = useState({
        cwid: "",
        email: "",
        firstName: "",
        lastName: "",
        middleName: "",
        department: "",
        division: "",
        title: "",
        description: ""
    })
    const { cwid, email, firstName, lastName, middleName, division, title} = state;
    const [selectedRoles, setSelectedRoles] = useState([]);

    const [formErrorsInst, setformErrInst] = useState<{[key: string]: any}>({});

    const [selectedDepartments, setSelectedDepartments] = useState([]);
    const [loading, setLoading] = useState(false);

    const router = useRouter()
    const isEdit = router.query.userId ? true : false;

    const dispatch = useDispatch();


    const handleValueChangeTargetValue = (field, value) => {
        if(value != '') formErrorsInst[field] = ''; 
        setState(state => ({ ...state, [field]: value }))
    }

    const validateEmail = (email) => {
        let mailformat = /^([A-Za-z0-9_\-\.])+\@([A-Za-z0-9_\-\.])+\.([A-Za-z]{2,4})$/;
        return email.match(mailformat) 
      };

  
    const checkFormValidations = () => {
        let formErrInst: formErrors = {};
        // cwid errors
        // if ( !cwid || cwid === '' || cwid.trim().length === 0 ) formErrInst.cwid = 'Please enter valid cwid!'
        // email errors
        // if ( !email || email === '' || email.trim().length === 0 || validateEmail(email) === false ) formErrInst.email = 'Please enter  valid  email!'
        
        // firstName errors
        if ( !firstName || firstName === '' || firstName.trim().length === 0 ) formErrInst.firstName = 'Please enter valid first Name!'
          // lastName errors
          if ( !lastName || lastName === '' || lastName.trim().length === 0 ) formErrInst.lastName = 'Please enter valid last Name!'
          // roles errors
          if ( !selectedRoles || selectedRoles.length === 0  ) formErrInst.selectedRole = 'Please select atleast one role!'

        setformErrInst(formErrInst)

        return formErrInst
    }


    const handleSubmit = async (event) => {
        event.preventDefault();
        const newErrors = checkFormValidations()

          if ( Object.keys(newErrors).length === 0 ) {
   
            let selectedRoleIds = [];
            let departmentIds = [];
            let isEditUserId = router.query.userId;
            let createOrUpdatePayload = { cwid, email, firstName, lastName, middleName, division, title, selectedRoleIds, departmentIds, isEditUserId }

            if (isEditUserId) {
                let resp = await createAdminUser(createOrUpdatePayload)
                if (resp && resp.length > 0 && resp[0] === 1) {
                    dispatch(createORupdateUserIDAction("UserID " + isEditUserId + " has been Updated"))
                    router.push("/admin/manage/users")
                }
            }
            else {
                let resp = await createAdminUser(createOrUpdatePayload)
                if (resp && resp.length > 0 && resp[0].userID) {
                    dispatch(createORupdateUserIDAction("UserID " + resp[0].userID + " has been Created"))
                    router.push("/admin/manage/users")
                }
            }
        }
    };

    useEffect(() => {
        let isEditUserId = router.query.userId;

        if (isEditUserId) {
            setLoading(true)
            let userDetails = fetchUserInfoByID(isEditUserId).then(result => {
                const { adminUsersDepartments, adminUsersRoles, email, nameFirst, nameLast, nameMiddle, personIdentifier } = result && result[0];
                if (adminUsersRoles) {
                    let roleNames = [];
                    allAdminRoles.map(role => {
                        adminUsersRoles.map((editRole) => {
                            if (editRole.roleID === role.roleID) roleNames.push(role.roleLabel)
                        })
                    })
                    setSelectedRoles(roleNames ? roleNames : [])
                }

                if (adminUsersDepartments) {
                    let departmentNames = [];

                    adminDepartments.map((department) => {
                        adminUsersDepartments.map((editIds) => {
                            if (editIds.departmentID == department.departmentID) departmentNames.push(department.departmentLabel)
                        }
                        )
                    })
                    setSelectedDepartments(departmentNames ? departmentNames : [])
                }

                setState(state => ({ ...state, cwid: personIdentifier, lastName: nameLast, firstName: nameFirst, email, middleName: nameMiddle }))
                setLoading(false)
            })
        }

    }, [router.query.userId])

    const CssTextField = styled(TextField)({
        '& .MuiOutlinedInput-root': {
            background: 'rgba(255, 255, 255, 0.9)',
            borderColor: '#ced4da',
            padding: '.375rem .75rem',
            '& fieldset': {
                top: '0px',
                '& legend': {
                    display: 'none'
                }
            },
            '&:hover fieldset': {
                borderColor: '#ced4da',
            },
        },
    });


    return (
        <>
            <PageHeader label={isEdit ? "Edit User" : "Add User"} />
            <Container className={styles.addUser}>
                {loading ?
                    <div className="d-flex justify-content-center align-items"><Loader /> </div>
                    :
                    <Form  onSubmit={handleSubmit} noValidate method="post">
                        <Row className="mb-3 pt-3" >
                            <Form.Group as={Col} sm={12} lg={4} controlId="formGridCwid">
                                <Form.Label>CWID<span className="text-danger">*</span></Form.Label>
                                <Form.Control required  type="text" value={cwid} name="cwid" disabled={isEdit ? true : false}
                                    onChange={(e) => handleValueChangeTargetValue("cwid", e.target.value)} maxLength={128}   placeholder="Enter CWID" 
                                    isInvalid={formErrorsInst.cwid }/>
                                <Form.Control.Feedback type="valid">Looks good!</Form.Control.Feedback>
                                <Form.Control.Feedback type='invalid'>
                                 { formErrorsInst.cwid }
                                </Form.Control.Feedback>
                            </Form.Group>

                            <Form.Group as={Col} sm={12} lg={6} controlId="formGridCwid">
                                <Form.Label>Primary Email<span className="text-danger">*</span></Form.Label>
                                <Form.Control required type="email" disabled={isEdit ? true : false} maxLength={128} value={email} name="email" onChange={(e) => handleValueChangeTargetValue("email", e.target.value)} placeholder="Enter Email" 
                                 isInvalid={ formErrorsInst.email }/>
                                <Form.Control.Feedback type="valid">Looks good!</Form.Control.Feedback>
                                <Form.Control.Feedback type='invalid'>
                                 { formErrorsInst.email }
                                </Form.Control.Feedback>
                            </Form.Group>
                        </Row>
                        <Row className="mb-3 pt-3" >
                            <Form.Group as={Col} sm={12} lg={4} controlId="formGridFirstname">
                                <Form.Label>First Name<span className="text-danger">*</span></Form.Label>
                                <Form.Control required  type="text" maxLength={128} placeholder="Enter First name" /*isInvalid={ validated && firstName.trim().length == 0}*/ value={firstName} name="firstName" onChange={(e) => handleValueChangeTargetValue("firstName", e.target.value)} 
                                    isInvalid={formErrorsInst.firstName }/>
                                <Form.Control.Feedback>Looks good!</Form.Control.Feedback>
                                <Form.Control.Feedback type='invalid'>
                                 { formErrorsInst.firstName }
                                </Form.Control.Feedback>
                            </Form.Group>

                            <Form.Group as={Col} sm={12} lg={4} controlId="formGridMiddleName">
                                <Form.Label>Middle Name</Form.Label>
                                <Form.Control type="text" placeholder="Enter Middle name" maxLength={128} value={middleName} name="middleName" onChange={(e) => handleValueChangeTargetValue("middleName", e.target.value)} />
                                <Form.Control.Feedback>Looks good!</Form.Control.Feedback>
                            </Form.Group>

                            <Form.Group as={Col} sm={12} lg={4} controlId="formGridLastName">
                                <Form.Label>Last Name<span className="text-danger">*</span></Form.Label>
                                <Form.Control required type="text" maxLength={128} placeholder="Enter Last name" /* isInvalid={ validated && lastName.trim().length == 0} */ value={lastName} name="lastName" onChange={(e) => handleValueChangeTargetValue("lastName", e.target.value)} 
                                     isInvalid={ formErrorsInst.lastName }/>
                                <Form.Control.Feedback>Looks good!</Form.Control.Feedback>
                                <Form.Control.Feedback type='invalid'>
                                 { formErrorsInst.lastName }
                                </Form.Control.Feedback>
                            </Form.Group>
                        </Row>
                        <Row className="mb-3 pt-3" >
                            <Form.Group as={Col} sm={12} lg={8} controlId="formGridCwid">
                                <Form.Label>Primary organizational Unit </Form.Label>
                                <Form.Control type="text" value={division} name="division" maxLength={200}
                                    onChange={(e) => handleValueChangeTargetValue("division", e.target.value)} placeholder="Enter Primary organizational Unit" />
                                <Form.Control.Feedback>Looks good!</Form.Control.Feedback>
                                <Form.Control.Feedback type="invalid">
                                    Please enter a Primary Organization Unit.
                                </Form.Control.Feedback>
                            </Form.Group>

                            <Form.Group as={Col} sm={12} lg={4} controlId="formGridTitle">
                                <Form.Label>Title</Form.Label>
                                <Form.Control type="text" placeholder="Enter Title" maxLength={200} value={title} name="title" onChange={(e) => handleValueChangeTargetValue("title", e.target.value)} />
                                <Form.Control.Feedback>Looks good!</Form.Control.Feedback>
                                <Form.Control.Feedback type="invalid">
                                    Please enter a Title.
                                </Form.Control.Feedback>
                            </Form.Group>
                        </Row>
                        <Row className="mb-3">
                            <Form.Group as={Col} sm={12} lg={12} controlId="formGridDepartment">
                                <Form.Label>Organizational unit(s) user can manage</Form.Label>
                                <Autocomplete
                                    freeSolo
                                    multiple
                                    id="institutions"
                                    disableClearable
                                    value={selectedDepartments}
                                    options={adminDepartments.map((option) => option.departmentLabel)}
                                    onChange={(event, value) => setSelectedDepartments(value as string[])}
                                    renderInput={(params) => (
                                        <CssTextField
                                            variant="outlined"
                                            {...params}
                                            InputProps={{
                                                ...params.InputProps,
                                                type: 'search',
                                            }}
                                        />
                                    )}
                                />
                            </Form.Group>
                        </Row>

                        <Row className="mb-3">
                            <Form.Group as={Col} sm={12} lg={12} controlId="formGridRole">
                                <Form.Label>Role(s)<span className="text-danger">*</span></Form.Label>
                                <Autocomplete
                                    freeSolo
                                    multiple
                                    id="roles"
                                    disableClearable
                                    value={selectedRoles}
                                    options={allAdminRoles.map((option) => option.roleLabel)}
                                    onChange={(event, value) => setSelectedRoles(value as string[])}
                                    renderInput={(params) => (
                                        <CssTextField
                                            variant="outlined"
                                            {...params}
                                            InputProps={{
                                                ...params.InputProps,
                                                type: 'search',
                                            }}
                                        />
                                    )}
                                />
                                 { formErrorsInst.selectedRole ? <p className="text-danger">{formErrorsInst.selectedRole}</p>:""}
                            </Form.Group>
                        </Row>
                        <Row className="justify-content-center">
                            <Col md={4} sm={12} lg={2}>
                                <Button variant="primary" type="submit" className="primary mb-4 " disabled={cwid.trim().length === 0 && !validateEmail(email)}>
                                    {isEdit ? "Update" : "Submit"}
                                </Button>
                            </Col>
                        </Row>
                    </Form>
                }
                <ToastContainerWrapper />
            </Container>
        </>
    );
}

export default AddUser