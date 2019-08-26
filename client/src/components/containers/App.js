import App from '../ui/App'
import { connect } from 'react-redux'
import { withRouter } from 'react-router-dom'
import { reciterFetchData, identityFetchData, getSession } from '../../actions'

const mapStateToProps = state =>
    ({
        auth: state.auth,
        sid: state.sid,
        reciterFetching: state.reciterFetching,
        reciterData: state.reciterData,
        identityData: state.identityData,
        identityFetching: state.identityFetching,
        errors: state.errors
    })

const mapDispatchToProps = dispatch =>
    ({
        onLoad(uid, refresh = false) {
            dispatch(
                reciterFetchData(uid,refresh)
            )
        },
        getIdentity(uid) {
            dispatch(
                identityFetchData(uid)
            )
        },
        getSession(sid = '') {
            dispatch(
                getSession(sid)
            )
        }
    })

const Container = connect(mapStateToProps, mapDispatchToProps)(App)
export default withRouter(Container)