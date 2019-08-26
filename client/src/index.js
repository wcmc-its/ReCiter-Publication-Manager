import React from 'react';
import { render } from 'react-dom'
import storeFactory from './store'
import { Provider } from 'react-redux'
import { addError } from './actions'
import './index.css';
import App from './components/containers/App'
import ReCiterRouter from './router'

const handleError = error => {
    store.dispatch(
        addError(error.message)
    )
}

const store = storeFactory()

window.React = React
window.store = store

window.addEventListener("error", handleError)

render(
    <Provider store={store}>
        <ReCiterRouter />
    </Provider>,
    document.getElementById('root')
)
