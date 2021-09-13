import React, { Component } from "react";
import Header from "../ui/Header";
import Footer from "../ui/Footer";
import { Button, Form, FormGroup, FormControl } from "react-bootstrap";
import "../../css/Login.css";

export default class Login extends Component {
  constructor(props) {
    super(props);

    this.state = {
      username: "",
      password: "",
      invalidCredentialsFlag: false
    };
    this.authUser = this.authUser.bind(this)
  }
  validateForm() {
    return this.state.username.length > 0 && this.state.password.length > 0;
  }

  handleChange = event => {
    this.setState({
      [event.target.id]: event.target.value
    });
  };

  handleSubmit = event => {
    event.preventDefault();
  };
  authUser()
  {
    this.props.authUser({
      username: this._username.value,
      password: this._password.value
    })
    let timeout = 3, count = 0
    const awaitServer = setInterval(() => {
      if(this.props.auth.isLoggedIn) {
        this.setState({
          invalidCredentialsFlag: false
        })
        clearInterval(awaitServer)
        return this.props.history.push('/search')
      }
      else if(count >= timeout)
      {
        clearInterval(awaitServer)
        this.setState({
          invalidCredentialsFlag: true
        })
        return console.log('failed to auth')
      }
      count += 1
      return 
    }, 100)
  }
  render() {
    return (
      <div className="login-main-container">
        <Header className="header" />
        <div className="form-container">
          <Form className="login-form" onSubmit={this.handleSubmit}>
            <h3 className="login-header">Sign into your account</h3>
            <Form.Text className="text-muted">
              Please enter your username and password to log in.
            </Form.Text>
            <FormGroup controlId="username">
              <FormControl
                autoFocus
                type="username"
                value={this.state.username}
                onChange={this.handleChange}
                placeholder="Username"
                ref={u => this._username = u}
              />
            </FormGroup>
            <FormGroup controlId="password">
              <FormControl
                value={this.state.password}
                onChange={this.handleChange}
                type="password"
                placeholder="Password"
                ref={p => this._password = p}
              />
            </FormGroup>
            <Button
              className="login-btn"
              disabled={!this.validateForm()}
              onClick={this.authUser}
              type="submit"
            >
              Sign in
            </Button>
            {(this.state.invalidCredentialsFlag)?(<p style={{color: 'red'}}>Bad Credentials</p>):null}
          </Form>
        </div>

        <Footer className="footer" />
      </div>
    );
  }
}
