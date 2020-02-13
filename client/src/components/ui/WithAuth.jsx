import React, { Component } from 'react';
import { Redirect } from 'react-router-dom';
// import { connect } from 'react-redux'
// import { storeUsername } from '../../actions'

function WithAuth(ComponentToProtect) {
    return class extends Component {
        constructor() {
            super();
            this.state = {
                loading: false,
                redirect: false,
                username: ''
            };
        }
        componentDidMount() {
            fetch('/users/reciter/validate', {
                method: "POST"
            })
            .then(r => r.json())
            .then(res => {
                if(!res.success)
                {
                    const error = new Error(res.message);
                    throw error;
                }
                return this.setState({ loading: false, redirect: false, username: res.username });
            })
            .catch(err => {
                return this.setState({ loading: false, redirect: true });
            });
        }
        render() {
            const { loading, redirect } = this.state;
            if (loading) {
                return null;
            }
            if (redirect) {
                return <Redirect to="/login" />;
            }
            return (
                <React.Fragment>
                    <ComponentToProtect {...this.props} username={this.state.username}/>
                </React.Fragment>
            );
        }
    }
}

// const mapDispatch = dispatch => ({
//     storeUsername: (username) => dispatch(storeUsername(username))
// })
// export default connect(null, mapDispatch)(WithAuth)
export default WithAuth
