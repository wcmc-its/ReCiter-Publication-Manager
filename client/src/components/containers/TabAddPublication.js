import { TabAddPublication } from '../ui/TabAddPublication'
import { connect } from 'react-redux'
import { pubmedFetchData, reciterUpdatePublication } from '../../actions'

const mapStateToProps = state =>
    ({
        reciterData: state.reciterData,
        identityData: state.identityData,
        pubmedFetching: state.pubmedFetching,
        pubmedData: state.pubmedData,
        errors: state.errors
    })
const mapDispatchToProps = dispatch =>
    ({
        getPubmedPublications(request) {
            dispatch(
                pubmedFetchData(request)
            )
        },
        updatePublication(uid, request) {
            dispatch(
                reciterUpdatePublication(uid, request)
            )
        }
    })
export default connect(mapStateToProps, mapDispatchToProps)(TabAddPublication)