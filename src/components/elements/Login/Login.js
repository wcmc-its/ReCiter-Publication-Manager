import React, { useState, useEffect } from "react";
import { Button, Form, FormGroup, FormControl, Row, Col } from "react-bootstrap";
import styles from "./Login.module.css";
import { Footer } from "../Footer/Footer";
import ToastContainerWrapper from "../ToastContainerWrapper/ToastContainerWrapper"
import {
  reciterFetchData,
  authUser
} from "../../../redux/actions/actions";
import { useSelector, useDispatch } from "react-redux";
import { useRouter } from "next/router";
import Header from "../Header/Header"; 

const Login = () => {
    const router = useRouter()
    const dispatch = useDispatch()
    const auth = useSelector((state) => state.auth)
    const sid = useSelector((state) => state.sid)
    const reciterFetching = useSelector((state) => state.reciterFetching)
    const reciterData = useSelector((state) => state.reciterData)
    const errors = useSelector((state) => state.errors)

    const [invalidCredentialsFlag, setInvalidCredentialsFlag] = useState(false)
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const [isShowButton, setIsShowButton] = useState(true)

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

    const handleSubmit = e => {
      e.preventDefault()
    }

    const handlePasswordInput = e => {
        setPassword(e.target.value)
        validateForm()
    }

    const authenticateUser = () =>{
        dispatch(authUser({
            username: username,
            password: password,
        }))

        if(auth.isLoggedIn) {
            setInvalidCredentialsFlag(false)
            router.push('/search')
        } else {
            setInvalidCredentialsFlag(true)
            return console.log("failed to auth");
        }
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
                        onClick={authenticateUser}
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