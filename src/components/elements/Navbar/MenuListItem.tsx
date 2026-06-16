import React from "react";
import Link from 'next/link'
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { MenuItem } from "../../../../types/menu";
import Image from 'next/image';
import { useRouter } from 'next/router';
import styles from './Navbar.module.css'

const MenuListItem: React.FC<MenuItem> = ({ title, to, id, imgUrl, imgUrlActive, muiIcon, disabled }) => {
  const router = useRouter();
  const customRouterPathNames = (routerPath) => {
    if (routerPath === "/notifications/[userId]") { return "/notifications" }
    else if (routerPath === "/manageprofile/[userId]") { return "/manageprofile" }
    else return router.pathname
  }

  const pathName = customRouterPathNames(router.pathname);
  const selected = to.includes(pathName) || pathName.startsWith(to);

  const renderIcon = () => {
    if (muiIcon) return muiIcon;
    return (
      <Image
        src={imgUrl}
        height={15}
        width={15}
        alt={title}
        style={{ filter: 'brightness(0) invert(1)', opacity: selected ? 1 : 0.5 }}
      />
    );
  };

  if (disabled && !selected) {
    return (
      <>
        <ListItem component="a" selected={selected} sx={{ opacity: 0.35, cursor: 'not-allowed', '&:hover': { background: 'transparent' } }} title="Select a person from Find People first">
          <ListItemIcon>
            {renderIcon()}
          </ListItemIcon>
          <ListItemText primary={title} />
        </ListItem>
      </>
    )
  }

  return (
    <>
      <Link href={to} passHref key={`${title}_${id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
        <ListItem selected={selected}>
          <ListItemIcon>
            {renderIcon()}
          </ListItemIcon>
          <ListItemText primary={title} />
        </ListItem>
      </Link>
    </>
  )
}
export default MenuListItem;
