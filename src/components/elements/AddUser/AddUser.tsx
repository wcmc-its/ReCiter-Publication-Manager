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

const AddUser: FunctionComponent<FuncProps> = (props) => {

    //Store Data
    const adminDepartments = useSelector((state: RootStateOrAny) => state.AllAdminDepatments);
    const allAdminRoles = useSelector((state: RootStateOrAny) => state.AllAdminRoles);


    const [validated, setValidated] = useState(false)
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
    const { cwid, email, firstName, lastName, middleName, division, title } = state;
    const [selectedRoles, SetSelectedRoles] = useState([]);
    const [selectedDepartments, SetSelectedDepartments] = useState([]);
    const [loading, setLoading] = useState(false);

    const router = useRouter()
    const isEdit = router.query.userId ? true : false;

    const dispatch = useDispatch();

    const handleValueChangeTargetValue = (inputName, e) => {
        setState(state => ({ ...state, [inputName]: e.target.value }))
    }

    const handleSubmit = async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        // if (form.checkValidity() === false) {
        //     event.preventDefault();
        //     event.stopPropagation();
        // }
        setValidated(true);

        if (form && form.checkValidity() === true) {
            let selectedRoleIds = [];
            let departmentIds = [];
            let Departmets = adminDepartments.filter(department => { if (selectedDepartments.includes(department.departmentLabel)) departmentIds.push(department.departmentID) })
            let roleIds = allAdminRoles.filter(role => { if (selectedRoles.includes(role.roleLabel)) selectedRoleIds.push(role.roleID) })
            // console.log("department ids",departmentIds )
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
                    SetSelectedRoles(roleNames ? roleNames : [])
                }

                if (adminUsersDepartments) {
                    let departmentNames = [];

                    adminDepartments.map((department) => {
                        adminUsersDepartments.map((editIds) => {
                            if (editIds.departmentID == department.departmentID) departmentNames.push(department.departmentLabel)
                        }
                        )
                    })
                    SetSelectedDepartments(departmentNames ? departmentNames : [])
                }

                setState(state => ({ ...state, cwid: personIdentifier, lastName: nameLast, firstName: nameFirst, email, middleName: nameMiddle }))
                setLoading(false)
            })
        }

    }, [])

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


    const validatePassword = () => {
        return false
    };



    return (
        <>
            <PageHeader label={isEdit ? "Edit User" : "Add User"} />
            <Container className={styles.addUser}>
                {loading ?
                    <div className="d-flex justify-content-center align-items"><Loader /> </div>
                    :
                    <Form validated={validated} onSubmit={handleSubmit} noValidate method="post">
                        <Row className="mb-3 pt-3" >
                            <Form.Group as={Col} sm={12} lg={4} controlId="formGridCwid">
                                <Form.Label>CWID<span className="text-danger">*</span></Form.Label>
                                <Form.Control required type="text" value={cwid} name="cwid" disabled={isEdit ? true : false}
                                    onChange={(e) => handleValueChangeTargetValue("cwid", e)} placeholder="Enter CWID" />
                                <Form.Control.Feedback>Looks good!</Form.Control.Feedback>
                                <Form.Control.Feedback type="invalid">
                                    Please enter a CWID.
                                </Form.Control.Feedback>
                            </Form.Group>

                            <Form.Group as={Col} sm={12} lg={6} controlId="formGridCwid">
                                <Form.Label>Primary Email<span className="text-danger">*</span></Form.Label>
                                <Form.Control required type="text" disabled={isEdit ? true : false} value={email} name="email" onChange={(e) => handleValueChangeTargetValue("email", e)} placeholder="Enter Email" />
                                <Form.Control.Feedback>Looks good!</Form.Control.Feedback>
                                <Form.Control.Feedback type="invalid">
                                    Please enter email.
                                </Form.Control.Feedback>
                            </Form.Group>
                        </Row>
                        <Row className="mb-3 pt-3" >
                            <Form.Group as={Col} sm={12} lg={4} controlId="formGridFirstname">
                                <Form.Label>First Name<span className="text-danger">*</span></Form.Label>
                                <Form.Control required type="text" placeholder="Enter First name" value={firstName} name="firstName" onChange={(e) => handleValueChangeTargetValue("firstName", e)} />
                                <Form.Control.Feedback>Looks good!</Form.Control.Feedback>
                                <Form.Control.Feedback type="invalid">
                                    Please enter a First name.
                                </Form.Control.Feedback>
                            </Form.Group>

                            <Form.Group as={Col} sm={12} lg={4} controlId="formGridMiddleName">
                                <Form.Label>Middle Name</Form.Label>
                                <Form.Control type="text" placeholder="Enter Middle name" value={middleName} name="middleName" onChange={(e) => handleValueChangeTargetValue("middleName", e)} />
                                <Form.Control.Feedback>Looks good!</Form.Control.Feedback>
                            </Form.Group>

                            <Form.Group as={Col} sm={12} lg={4} controlId="formGridLastName">
                                <Form.Label>Last Name<span className="text-danger">*</span></Form.Label>
                                <Form.Control required type="text" placeholder="Enter Last name" value={lastName} name="lastName" onChange={(e) => handleValueChangeTargetValue("lastName", e)} />
                                <Form.Control.Feedback>Looks good!</Form.Control.Feedback>
                                <Form.Control.Feedback type="invalid">
                                    Please enter a Last name.
                                </Form.Control.Feedback>
                            </Form.Group>
                        </Row>
                        <Row className="mb-3 pt-3" >
                            <Form.Group as={Col} sm={12} lg={8} controlId="formGridCwid">
                                <Form.Label>Primary organizational Unit </Form.Label>
                                <Form.Control type="text" value={division} name="division"
                                    onChange={(e) => handleValueChangeTargetValue("division", e)} placeholder="Enter Primary organizational Unit" />
                                <Form.Control.Feedback>Looks good!</Form.Control.Feedback>
                                <Form.Control.Feedback type="invalid">
                                    Please enter a Primary Organization Unit.
                                </Form.Control.Feedback>
                            </Form.Group>

                            <Form.Group as={Col} sm={12} lg={4} controlId="formGridTitle">
                                <Form.Label>Title</Form.Label>
                                <Form.Control type="text" placeholder="Enter Title" value={title} name="title" onChange={(e) => handleValueChangeTargetValue("title", e)} />
                                <Form.Control.Feedback>Looks good!</Form.Control.Feedback>
                                <Form.Control.Feedback type="invalid">
                                    Please enter a Title.
                                </Form.Control.Feedback>
                            </Form.Group>
                        </Row>
                        <Row className="mb-3">
                            <Form.Group as={Col} sm={12} lg={12} controlId="formGridDepartment">
                                <Form.Label>Organizational unit(s) user can manage</Form.Label>
                                {/* <Form.Control required type="text" placeholder="Enter Department"  value={department} name="department" onChange={(e) => handleValueChangeTargetValue("department", e)}/>
                        <Form.Control.Feedback>Looks good!</Form.Control.Feedback>
                        <Form.Control.Feedback type="invalid">
                            Please choose a Department.
                        </Form.Control.Feedback> */}
                                <Autocomplete
                                    freeSolo
                                    multiple
                                    id="institutions"
                                    disableClearable
                                    value={selectedDepartments}
                                    options={adminDepartments.map((option) => option.departmentLabel)}
                                    onChange={(event, value) => SetSelectedDepartments(value as string[])}
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
                        {/*  <Row className="mb-3">
                    <Form.Group as={Col} sm={12} lg={4} controlId="formGridDivision">
                        <Form.Label>Division</Form.Label>
                        <Form.Control required type="text" placeholder="Enter Division" value={division} name="division" onChange={(e) => handleValueChangeTargetValue("division", e)} />
                        <Form.Control.Feedback>Looks good!</Form.Control.Feedback>
                        <Form.Control.Feedback type="invalid">
                            Please choose a Division.
                        </Form.Control.Feedback>

                    </Form.Group>
                </Row> */}

                        <Row className="mb-3">
                            <Form.Group as={Col} sm={12} lg={12} controlId="formGridRole">
                                <Form.Label>Role(s)*</Form.Label>
                                {/* <Select
                            labelId="demo-multiple-name-label"
                            id="demo-multiple-name"
                            multiple
                            value={selectedRoles}
                            onChange={handleChange}
                            input={<OutlinedInput />}
                            MenuProps={MenuProps}
                        >
                            {allAdminRoles.map((role) => (
                                <MenuItem
                                    key={role}
                                    value={role.id}
                                // style={getStyles(name, personName, theme)}
                                >
                                    {role.roleLabel}
                                </MenuItem>
                            ))}
                        </Select> */}
                                <Autocomplete
                                    freeSolo
                                    multiple
                                    id="roles"
                                    disableClearable
                                    value={selectedRoles}
                                    options={allAdminRoles.map((option) => option.roleLabel)}
                                    onChange={(event, value) => SetSelectedRoles(value as string[])}
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
                        {/*  <Row className="mb-3">
                    <Form.Group as={Col} sm={12} lg={4} controlId="FormGridAccessControl">
                        <Form.Label>Access Controll</Form.Label>
                        <Form.Control required as="select">
                            <option >User</option>
                            <option>SuperUser</option>
                            <option>DepartmentalUser</option>
                        </Form.Control>
                        <Form.Control.Feedback>Looks good!</Form.Control.Feedback>
                        <Form.Control.Feedback type="invalid">
                            Please select one role.
                        </Form.Control.Feedback>
                    </Form.Group>
                    <Form.Group as={Col} sm={12} lg={8} controlId="FormGridAccessDescription">
                        <Form.Label></Form.Label>
                        <Form.Control required type="text" placeholder="Enter Title"  value={description} name="description" onChange={(e) => handleValueChangeTargetValue("description", e)} />
                        <Form.Control.Feedback>Looks good!</Form.Control.Feedback>
                        <Form.Control.Feedback type="invalid">
                            Please choose a Title.
                        </Form.Control.Feedback>
                    </Form.Group>
                </Row>
                <Row className="mb-3">
                    <Form.Group as={Col} sm={12} lg={4}>
                    </Form.Group>
                    <Form.Group as={Col} sm={12} lg={8} id="formGridCheckbox">
                        <Form.Check required type="checkbox" label="Accept to create user" />
                        <Form.Control.Feedback>Looks good!</Form.Control.Feedback>
                        <Form.Control.Feedback type="invalid">
                            Please check the box.
                        </Form.Control.Feedback>
                    </Form.Group>
                </Row> */}

                        <Row className="justify-content-center">
                            <Col md={4} sm={12} lg={2}>
                                <Button variant="primary" type="submit" className="primary mb-4 ">
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