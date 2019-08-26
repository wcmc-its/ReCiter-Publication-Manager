import { Tabs } from '../ui/Tabs'
import { connect } from 'react-redux'

const mapStateToProps = state =>
    ({
        reciterData: state.reciterData,
    })

export default connect(mapStateToProps)(Tabs)