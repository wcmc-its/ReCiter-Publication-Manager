import { TabAccepted } from '../ui/TabAccepted'
import { connect } from 'react-redux'
import { reciterUpdatePublication } from '../../actions'

const mapStateToProps = state =>
    ({
        reciterData: state.reciterData,
        identityData: state.identityData
    })

const mapDispatchToProps = dispatch =>
    ({
        updatePublication(uid, request) {
            dispatch(
                reciterUpdatePublication(uid, request)
            )
        }
    })

export default connect(mapStateToProps, mapDispatchToProps)(TabAccepted)