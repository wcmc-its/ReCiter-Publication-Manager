import React from "react";
import Link from 'next/link'
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { MenuItem } from "../../../../types/menu";
import Image from 'next/image';

const MenuListItem: React.FC<MenuItem> = ({ title, to, key }) => {
  return (
    <>
    <Link href={to} passHref key={key}>
      <ListItem button component="a">
        <ListItemIcon>
          <Image 
            src="/images/icon-side-faculty_index.png"
            height={15}
            width={15}
            alt={title}
          />
        </ListItemIcon>
        <ListItemText primary={title} />
      </ListItem>
    </Link>
    </>
  )
}
export default MenuListItem;
