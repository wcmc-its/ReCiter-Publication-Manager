import React, { useState, FunctionComponent } from "react"
import { Form, Row, Col, Button, InputGroup, Container } from 'react-bootstrap'
import styles from './AddUser.module.css'

interface FuncProps {
    onAccept(id: number): void,
    onReject(id: number): void,
    item: any
}

const AddUser: FunctionComponent<FuncProps> = (props) => {

    const [validated, setValidated] = useState(false)

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        const form = event.currentTarget;
        if (form.checkValidity() === false) {
            event.preventDefault();
            event.stopPropagation();
        }

        setValidated(true);
    };

    const validatePassword = () => {
        return false
    };

    return (
        <Container className={styles.addUser}>
            <Form noValidate validated={validated} onSubmit={handleSubmit}>
                <Row className="mb-3 pt-3" >
                    <Form.Group as={Col} sm={12} lg={6} controlId="formGridUsername">
                        <Form.Label>Username</Form.Label>
                        <InputGroup hasValidation>
                            <InputGroup.Text id="inputGroupPrepend">@</InputGroup.Text>
                            <Form.Control required type="text" placeholder="Enter username" aria-describedby="inputGroupPrepend" />
                            <Form.Text id="passwordHelpBlock" muted>
                            Your username must be more than 4 characters and contain alphanumeric characters.
                            </Form.Text>
                            <Form.Control.Feedback>Looks good!</Form.Control.Feedback>
                            <Form.Control.Feedback type="invalid">
                                Please choose a username.
                            </Form.Control.Feedback>
                        </InputGroup>
                    </Form.Group>

                    <Form.Group as={Col} sm={12} lg={6} controlId="formGridPassword">
                        <Form.Label>Password</Form.Label>
                        <Form.Control required type="password" placeholder="Password" aria-describedby="passwordHelpBlock" isValid={false}/>
                        <Form.Text id="passwordHelpBlock" muted>
                            Your password must be 8-20 characters long, contain letters and numbers.
                        </Form.Text>
                        <Form.Control.Feedback>Looks good!</Form.Control.Feedback>
                        <Form.Control.Feedback type="invalid">
                            Please choose a password.
                        </Form.Control.Feedback>
                    </Form.Group>
                </Row>

                <Row className="mb-3">
                    <Form.Group as={Col} sm={12} lg={4} controlId="formGridFirstname">
                        <Form.Label>First name</Form.Label>
                        <Form.Control required type="text" placeholder="Enter First name" />
                        <Form.Control.Feedback>Looks good!</Form.Control.Feedback>
                        <Form.Control.Feedback type="invalid">
                            Please choose a First name.
                        </Form.Control.Feedback>
                    </Form.Group>

                    <Form.Group as={Col} sm={12} lg={4} controlId="formGridMiddleName">
                        <Form.Label>Middle name</Form.Label>
                        <Form.Control type="text" placeholder="Enter Middle name" />
                        <Form.Control.Feedback>Looks good!</Form.Control.Feedback>
                    </Form.Group>

                    <Form.Group as={Col} sm={12} lg={4} controlId="formGridLastName">
                        <Form.Label>Last name</Form.Label>
                        <Form.Control required type="text" placeholder="Enter Last name" />
                        <Form.Control.Feedback>Looks good!</Form.Control.Feedback>
                        <Form.Control.Feedback type="invalid">
                            Please choose a Last name.
                        </Form.Control.Feedback>
                    </Form.Group>
                </Row>

                <Row className="mb-3">
                    <Form.Group as={Col} sm={12} lg={6} controlId="formGridTitle">
                        <Form.Label>Title</Form.Label>
                        <Form.Control type="text" placeholder="Enter title" />
                        <Form.Control.Feedback>Looks good!</Form.Control.Feedback>
                    </Form.Group>
                    <Form.Group as={Col} sm={12} lg={6} controlId="formGridRole">
                        <Form.Label>Role</Form.Label>
                        <Form.Control required as="select">
                            <option>User</option>
                            <option>SuperUser</option>
                            <option>DepartmentalUser</option>
                        </Form.Control>
                        <Form.Control.Feedback>Looks good!</Form.Control.Feedback>
                        <Form.Control.Feedback type="invalid">
                            Please select one role.
                        </Form.Control.Feedback>
                    </Form.Group>
                </Row>

                <Form.Group className="mb-3" id="formGridCheckbox">
                    <Form.Check required type="checkbox" label="Accept to create user" />
                    <Form.Control.Feedback>Looks good!</Form.Control.Feedback>
                    <Form.Control.Feedback type="invalid">
                        Please check the box.
                    </Form.Control.Feedback>
                </Form.Group>

                <Row className="justify-content-center">
                    <Col md={4} sm={12} lg={4}>
                        <Button variant="primary" type="submit" className="primary mb-4 w-100">
                            Submit
                        </Button>
                    </Col>
                </Row>
            </Form>
        </Container>
    );

}

export default AddUser