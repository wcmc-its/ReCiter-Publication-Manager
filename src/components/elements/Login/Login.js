import React, { useState, useEffect } from "react";
import { Button, Form, FormGroup, FormControl } from "react-bootstrap";
import styles from "./Login.module.css";
import { Footer } from "../Footer/Footer";
import ToastContainerWrapper from "../ToastContainerWrapper/ToastContainerWrapper"
import {
  reciterFetchData,
  authUser
} from "../../../redux/actions/actions";
import { useSelector, useDispatch } from "react-redux";
import { useRouter } from "next/router";

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

   /*  useEffect((refresh = false) => {
      dispatch(reciterFetchData(refresh))
    }) */

    const validateForm = () => {
      return state.username.length > 0 && state.password.length > 0;
    }

    const handleUserNameInput = e => {
        setUsername(e.target.value)
    }

    const handleSubmit = e => {
      e.preventDefault()
    }

    const handlePasswordInput = e => {
        setPassword(e.target.value)
    }

    const authenticateUser = () =>{
        dispatch(authUser({
            username: username,
            password: password,
        }))
        let timeout = 3,
        count = 0;
        const awaitServer = setInterval(() => {
        if (auth.isLoggedIn) {
                setInvalidCredentialsFlag(false)
                clearInterval(awaitServer);
                return router.push('/search')
        } else if (count >= timeout) {
                clearInterval(awaitServer);
                setInvalidCredentialsFlag(true)
                return console.log("failed to auth");
        }
        count += 1;
        return;
        }, 100);
    }

    return (
        <div className={styles.loginMainContainer}>
        <div className={styles.formContainer}>
            <Form className={styles.loginForm} onSubmit={handleSubmit}>
            <h3 className={styles.loginHeader}>Sign into your account</h3>
            <Form.Text className="text-muted">
                Please enter your username and password to log in.
            </Form.Text>
            <FormGroup controlId="username">
                <FormControl
                autoFocus
                type="username"
                value={username}
                onChange={handleUserNameInput}
                placeholder="Username"
                />
            </FormGroup>
            <FormGroup controlId="password">
                <FormControl
                value={password}
                onChange={handlePasswordInput}
                type="password"
                placeholder="Password"
                />
            </FormGroup>
            <Button
                className="loginBtn"
                disabled={!validateForm}
                onClick={authenticateUser}
                type="submit"
            >
                Sign in
            </Button>
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