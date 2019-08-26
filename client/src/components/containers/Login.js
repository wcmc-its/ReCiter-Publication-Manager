import Login from '../ui/Login'
import { connect } from 'react-redux'
import { withRouter } from 'react-router-dom'
import { reciterFetchData, authUser, getSession } from '../../actions'

const mapStateToProps = state =>
    ({
        auth: state.auth,
        sid: state.sid,
        reciterFetching: state.reciterFetching,
        reciterData: state.reciterData,
        errors: state.errors
    })

const mapDispatchToProps = dispatch =>
    ({
        onLoad(refresh = false) {
            dispatch(
                reciterFetchData(refresh)
            )
        },
        authUser(authObj = {}) {
            dispatch(
                authUser(authObj)
            )
        },
        getSession(sid = '') {
            dispatch(
                getSession(sid)
            )
        }
    })

const Container = connect(mapStateToProps, mapDispatchToProps)(Login)
export default withRouter(Container)