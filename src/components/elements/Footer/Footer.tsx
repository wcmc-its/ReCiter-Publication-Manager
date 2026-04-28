import styles from "./Footer.module.css";

export const Footer = () => {
    return (
        <footer className={styles.footer}>
            &copy; {new Date().getFullYear()} by Weill Cornell Medical College.
            All rights reserved.
        </footer>
    );
};
