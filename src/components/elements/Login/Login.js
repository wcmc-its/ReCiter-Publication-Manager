import React, { useState, useEffect } from "react";
import { Button, Form, FormGroup, FormControl, Row, Col } from "react-bootstrap";
import styles from "./Login.module.css";
import { Footer } from "../Footer/Footer";
import ToastContainerWrapper from "../ToastContainerWrapper/ToastContainerWrapper"
import Router from "next/router"
import Header from "../Header/Header"
import { signIn,getSession } from "next-auth/client"
import { toast } from "react-toastify"
import { allowedPermissions } from "../../../utils/constants";


const Login = () => {

    const [invalidCredentialsFlag, setInvalidCredentialsFlag] = useState(false)
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const [isShowButton, setIsShowButton] = useState(true)
    const session = getSession();

   useEffect(() => {
        
    })

    const validateForm = () => {
        if(username === ''){
            setIsShowButton(true)
        } else if(password === '') {
            setIsShowButton(true)
        } else {
            setIsShowButton(false)
        }
    }

    const handleUserNameInput = e => {
        setUsername(e.target.value)
        validateForm()
    }

    const handleSubmit = async(e) => {
      e.preventDefault()

      let signInResponse = await signIn("direct_login", {
        username: username,
        password: password,
        redirect: false
       })
       if (signInResponse.status == 200) {
            toast.info("Successful Login", {
                position: "top-right",
                autoClose: 2000,
                theme: "colored"
            });
            //if(session && session.data && session.data.userRoles)
             getSession().then((session) => {
                if (session) {
                    let userPermissions = JSON.parse(session.data.userRoles);
                    let userName = session.data.username;
                    let personIdentifier = userPermissions && userPermissions.length > 0 ? userPermissions[0].personIdentifier : ""
                    if((userPermissions.some(role => role.roleLabel === allowedPermissions.Curator_Self)) && userName)  
                        Router.push(`${window.location.origin}/curate/${personIdentifier}`);
                    else 
                        Router.push(`${window.location.origin}/search`);
                } 
            });
            
        } else {
            setInvalidCredentialsFlag(true)
            toast.error("Invalid credentials", {
                position: "top-right",
                autoClose: 2000,
                theme: "colored"
            });
        }
    }

    const handlePasswordInput = e => {
        setPassword(e.target.value)
        validateForm()
    }

    return (
        <div className={styles.loginMainContainer}>
        <Header/>
        <div className={styles.formContainer}>
            <Form className={styles.loginForm} onSubmit={handleSubmit}>
            <h3>Sign in to your account</h3>
            <p>Please enter your CWID and password to log in.</p>
            <FormGroup controlId="username" style={{marginBottom: '10px'}}>
                <FormControl
                autoFocus
                type="username"
                value={username}
                onChange={handleUserNameInput}
                placeholder="Username"
                style={{ 
                        background: `url("../../../images/icon-login-user.png")`,
                        backgroundSize: '15px 15px',
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'left 10px center',
                        paddingLeft: '32px'
                    }}
                required={true}
                />
            </FormGroup>
            <FormGroup controlId="password" style={{marginBottom: '10px'}}>
                <FormControl
                value={password}
                onChange={handlePasswordInput}
                type="password"
                placeholder="Password"
                style={{
                        background: `url("../../../images/icon-login-pass.png")`,
                        backgroundSize: '15px 15px', 
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'left 10px center',
                        paddingLeft: '32px'
                    }}
                required={true}
                />
            </FormGroup>
            <Row style={{marginTop: '15px'}}>
                <Col xs={6} className='mt-2 w-100'>
                    <Button
                        className="btn btn-danger"
                        style={{float: 'right'}}
                        disabled={isShowButton}
                        type="submit"
                    >
                        Sign in
                    </Button>
                </Col>
            </Row>
            {invalidCredentialsFlag ? (
                <ToastContainerWrapper />
            ) : null}
            </Form>
        </div>

        <Footer />
        </div>
    );
};
export default Login