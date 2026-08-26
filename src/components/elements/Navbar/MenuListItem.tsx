import React from "react";
import Link from 'next/link'
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { MenuItem } from "../../../../types/menu";
import Image from 'next/image';
import { useRouter } from 'next/router';
import styles from './Navbar.module.css'

const MenuListItem: React.FC<MenuItem & { selected?: boolean }> = ({ title, to, id, imgUrl, imgUrlActive, muiIcon, disabled, selected: selectedProp }) => {
  const router = useRouter();
  const customRouterPathNames = (routerPath) => {
    if (routerPath === "/notifications/[userId]") { return "/notifications" }
    else if (routerPath === "/manageprofile/[userId]") { return "/manageprofile" }
    else return router.pathname
  }

  const pathName = customRouterPathNames(router.pathname);
  // Sibling-blind fallback: matches this item against the route in isolation, with no
  // knowledge of any other menu item. That's wrong when one item's `to` is a prefix of
  // another's (e.g. '/literature' and '/literature/analyzer' both match on
  // /literature/analyzer, double-highlighting the nav). SideNavbar avoids that by
  // computing the longest match across every sibling ONCE and passing the winner down
  // as the `selected` prop; when that prop is provided it is used verbatim and this
  // predicate is skipped. This predicate remains the fallback for callers that render a
  // MenuListItem without siblings to compare against (NestedListItem's menu items, which
  // pass no `selected` prop). The last clause keeps the notifications/manageprofile items
  // lit, whose `to` carries the username while pathName is normalized to the base. The
  // trailing '/' guards against sibling prefixes (e.g. /report must not match /reportbuilder).
  const selfComputedSelected =
    to === pathName ||
    pathName.startsWith(to + '/') ||
    to.startsWith(pathName + '/');
  const selected = selectedProp !== undefined ? selectedProp : selfComputedSelected;

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
