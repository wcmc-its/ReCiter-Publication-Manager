import appReducer from './reducers'
import thunk from 'redux-thunk'
import { createStore, applyMiddleware, compose} from 'redux'

const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
const configureStore = process.env.NODE_ENV !== 'production' ? composeEnhancers(applyMiddleware(thunk)) : applyMiddleware(thunk)

export default (initialState={}) => {
    //return applyMiddleware(thunk)(createStore)(appReducer, initialState)
    return configureStore(createStore)(appReducer, initialState)


}

