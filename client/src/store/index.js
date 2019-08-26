import appReducer from './reducers'
import thunk from 'redux-thunk'
import { createStore, applyMiddleware } from 'redux'

export default (initialState={}) => {
    return applyMiddleware(thunk)(createStore)(appReducer, initialState)
}

