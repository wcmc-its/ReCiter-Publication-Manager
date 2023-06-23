import styles from "./PageHeader.module.css";

export const PageHeader = ({ label } : {
  label: string
}) => {
  return <h1 className={styles.header}>{label}</h1>
}