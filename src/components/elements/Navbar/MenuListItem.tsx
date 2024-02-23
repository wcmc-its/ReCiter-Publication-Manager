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
  const customRouterPathNames = (routerPath) => {
    if (routerPath === "/notifications/[userId]") { return "/notifications" }
    else if (routerPath === "/manageprofile/[userId]") { return "/manageprofile" }
    else return router.pathname
  }

  const pathName = customRouterPathNames(router.pathname);
  const selected = to.includes(pathName);

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
            primary={<span className={(disabled && !selected) ? styles.disabled : ''}>{title}</span>} 
            />
        </ListItem>
      </Link>
    </>
  )
}
export default MenuListItem;
