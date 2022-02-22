import React from "react";
import Link from 'next/link'
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { MenuItem } from "../../../../types/menu";
import Image from 'next/image';
import { useRouter } from 'next/router';
import styles from './Navbar.module.css'

const MenuListItem: React.FC<MenuItem> = ({ title, to, id, imgUrl, imgUrlActive, disabled }) => {
  const router = useRouter();
  const pathName = router.pathname;
  const selected = pathName.includes(to);

  if (disabled && !selected) {
    return (
      <>
        <ListItem component="a" selected={selected}>
          <ListItemIcon>
            <Image 
              src={selected ? imgUrlActive: imgUrl }
              height={15}
              width={15}
              alt={title}
            />
          </ListItemIcon>
          <ListItemText 
            disableTypography
            primary={<span className={styles.disabled}>{title}</span>} 
            />
        </ListItem>
      </>
    )
  }

  return (
    <>
      <Link href={to} passHref key={`${title}_${id}`}>
        <ListItem button component="a" selected={selected}>
          <ListItemIcon>
            <Image 
              src={selected ? imgUrlActive: imgUrl }
              height={15}
              width={15}
              alt={title}
            />
          </ListItemIcon>
          <ListItemText 
            disableTypography
            primary={<span className={disabled ? styles.disabled : ''}>{title}</span>} 
            />
        </ListItem>
      </Link>
    </>
  )
}
export default MenuListItem;
