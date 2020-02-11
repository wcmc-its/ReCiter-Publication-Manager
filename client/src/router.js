import React, { Component } from 'react';
import { BrowserRouter as Router, Route, Link } from "react-router-dom";
import Login from './components/containers/Login'
import App from './components/containers/App'
import Search from './components/ui/Search'
import ManageProfile from './components/containers/ManageProfile'
import ReviewSuggestions from './components/reviewSuggestions/reviewSuggestions';
import Individual from './components/reviewSuggestions/Individual/Individual'
import Logout from './components/ui/Logout'

import WithAuth from './components/ui/WithAuth'

export default class ReCiterRouter extends Component {
    render() {
        return (
            <Router>
                <div>
                    <Route exact path="/app/:uid" component={WithAuth(App)} />
                    <Route path="/login" component={Login} />
                    <Route path="/search" component={WithAuth(Search)} />
                    <Route path="/manage/:uid" component={WithAuth(ManageProfile)} />
                    <Route path='/reviewSuggestions' component={ReviewSuggestions} />
                    <Route path="/individual" component={Individual} />
                    <Route path="/logout" component={Logout} />
                </div>
            </Router>
        )
    }
}

