import methods from '../methods'

const initAuth = {
    username: '',
    isLoggedIn: false,
    accessToken: ''
}

const auth = (auth = initAuth, action) => {
    switch(action.type)
    {
        case methods.USER_LOGIN: // fetch api to authenticate user and receive results
            const newAuth = {
                username: action.auth.username || '',
                accessToken: action.auth.accessToken,
                isLoggedIn: true
            }
            return newAuth
        case methods.USER_LOGOUT:
            return auth
        default:
            return auth
    }
}

const sessionId = (sessionId = '', action) => {
    switch(action.type)
    {
        case methods.GET_SESSION_ID:
            return action.payload
        default:
            return sessionId
    }
}

export default auth
export { sessionId }