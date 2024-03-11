import React, { Component } from "react";
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Collapse from '@mui/material/Collapse';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import { MenuItem } from "../../../../types/menu";
import Image from 'next/image';
import MenuListItem from "./MenuListItem";
import Box from '@mui/material/Box';
import styles from './Navbar.module.css';
import { useSession } from 'next-auth/react';


type ImageSourcePropType = React.ComponentProps<typeof Image>['src']

type NestedListItemProps = {
  header: String,
  menuItems: Array<MenuItem>,
  imgUrl?: string | ImageSourcePropType
}

const NestedListItem: React.FC<NestedListItemProps> = ({ header, menuItems, imgUrl}) => {
  const [open, setOpen] = React.useState(false);
  const [session, loading] = useSession();


  const handleClick = () => {
    setOpen(!open);
  };

  return (
    <>
      <ListItemButton onClick={handleClick}>
        <ListItemIcon>
          <Image
            src={imgUrl || ""}
            height={15}
            width={15}
            alt='Menu Icon'
          />
        </ListItemIcon>
        <ListItemText primary={header} />
        {open ? <ExpandLess /> : <ExpandMore />}
      </ListItemButton>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <List component="div" disablePadding>
          {
            menuItems.map((item: MenuItem, index: number) => {
              let userPermissions = JSON.parse(session.data.userRoles);
              const matchedRoles = userPermissions.filter(role => item.allowedRoleNames.includes(role.roleLabel));
              if (matchedRoles.length >= 1) {
                return (
                  <Box p={2} key={index} className={styles.subMenu}>
                    <MenuListItem
                      title={item.title}
                      to={item.to}
                      id={index}
                      imgUrl={item.imgUrl}
                      imgUrlActive={item.imgUrlActive}
                    />
                  </Box>
                )
              }
            })
          }
        </List>
      </Collapse>
    </>
  )
}
export default NestedListItem;
