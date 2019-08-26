import { connect } from 'react-redux'
import { identityFetchData } from '../../actions'
import { withRouter } from 'react-router-dom'
import ManageProfile from '../ui/ManageProfile'

const mapStateToProps = state =>
({
        identityData: state.identityData,
        identityFetching: state.identityFetching,
        errors: state.errors

})

const mapDispatchToProps = dispatch =>
    ({
        getIdentity(uid) {
            dispatch(
                identityFetchData(uid)
            )
        }
    })
    
const Container = connect(mapStateToProps, mapDispatchToProps)(ManageProfile)
export default withRouter(Container)