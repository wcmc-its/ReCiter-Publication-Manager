import appStyles from '../App/App.module.css';
import styles from './Report.module.css';
import QuickReport from './QuickReport';
import SearchSummary from './SearchSummary';
import { FilterSection } from './FilterSection';

const Report = () => {
  return (
    <div>
      <div className={appStyles.mainContainer}>
        <h1 className={styles.header}>Create Reports</h1>
        <FilterSection />
        <QuickReport />
        <SearchSummary count={0}/>
      </div>
    </div>
  )
}

export default Report;