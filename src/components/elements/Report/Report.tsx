import appStyles from '../App/App.module.css';
import styles from './Report.module.css';
import QuickReport from './QuickReport';
import SearchSummary from './SearchSummary';

const Report = () => {
  return (
    <div>
      <div className={appStyles.mainContainer}>
        <h1 className={styles.header}>Create Reports</h1>
        <QuickReport />
        <SearchSummary count={0}/>
      </div>
    </div>
  )
}

export default Report;