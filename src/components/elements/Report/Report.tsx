import appStyles from '../App/App.module.css';
import styles from './Report.module.css';
import QuickReport from './QuickReport';

const Report = () => {
  return (
    <div>
      <div className={appStyles.mainContainer}>
        <h1 className={styles.header}>Create Reports</h1>
        <QuickReport />
      </div>
    </div>
  )
}

export default Report;