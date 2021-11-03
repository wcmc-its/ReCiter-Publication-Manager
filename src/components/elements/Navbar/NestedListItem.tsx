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

type NestedListItemProps = {
  header: String,
  menuItems: Array<MenuItem>,
}

const NestedListItem: React.FC<NestedListItemProps> = ({ header, menuItems}) => {
  const [open, setOpen] = React.useState(false);

  const handleClick = () => {
    setOpen(!open);
  };

  return (
    <>
      <ListItemButton onClick={handleClick}>
        <ListItemIcon>
          <Image 
              src="/images/icon-side-faculty_index.png"
              height={15}
              width={15}
            />
        </ListItemIcon>
        <ListItemText primary={header} />
        {open ? <ExpandLess /> : <ExpandMore />}
      </ListItemButton>
      <Collapse in={open} timeout="auto" unmountOnExit>
      <List component="div" disablePadding>
        {
          menuItems.map((item: MenuItem, index: number) => {
            return (
              <Box p={2} key={index}>
                <MenuListItem
                  title={item.title}
                  to='/search'
                  key={index}
                />
              </Box>
            )
          })
        }
        </List>
      </Collapse>
    </>
  )
}
export default NestedListItem;
