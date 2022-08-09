import * as React from 'react';
import { styled, useTheme } from '@mui/material/styles';
import MuiDrawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import Divider from '@mui/material/Divider';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import NestedListItem from './NestedListItem';
import { MenuItem } from '../../../../types/menu';
import MenuListItem from './MenuListItem';
import { ExpandNavContext } from './ExpandNavContext';
import facultyIcon from '../../../../public/images/icon-side-faculty_index.png';
import settingsIcon from '../../../../public/images/icon-side-admin_index.png';
import chartIcon from '../../../../public/images/icon-side-faculty_report.png';
import checkMarkIcon from '../../../../public/images/icon-side-check_mark.png';
import styles from './Navbar.module.css'
import facultyIconActive from '../../../../public/images/icon-side-faculty_index-active.png';
import settingsIconActive from '../../../../public/images/icon-side-faculty_admin-active.png';
import chartIconActive from '../../../../public/images/icon-side-faculty_report-active.png';
import checkMarkIconActive from '../../../../public/images/icon-side-check_mark-active.png';
import { useSelector, RootStateOrAny } from "react-redux";

type SideNavBarProps = {
    items: any
}

type drawer = {
    theme: any,
    open: any
}

const drawerWidth = 240;

const openedMixin = (theme: any) => ({
  top: 60,
  width: drawerWidth,
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  backgroundColor: '#f5f5f5',
});

const closedMixin = (theme: any) => ({
  top: 60,
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  width: `calc(${theme.spacing(7)} + 1px)`,
  [theme.breakpoints.up('sm')]: {
    width: `calc(${theme.spacing(9)} + 1px)`,
  },
  '& .MuiListItemText-root': {
    display: 'none',
  },
  backgroundColor: '#f5f5f5',
});

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  disableRipple: 'true',
  padding: theme.spacing(0, 1),
  // necessary for content to be below app bar
  ...theme.mixins.toolbar,
}));

const Drawer = styled(MuiDrawer, { shouldForwardProp: (prop) => prop !== 'open' })(
  ({ theme, open }: drawer) => ({
    width: drawerWidth,
    flexShrink: 0,
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    ...(open && {
      ...openedMixin(theme),
      '& .MuiDrawer-paper': openedMixin(theme),
    }),
    ...(!open && {
      ...closedMixin(theme),
      '& .MuiDrawer-paper': closedMixin(theme),
    }),
  }),
);

const StyledList = styled(List)({
  paddingTop: '0px',
  // selected and (selected + hover) states
  '&& .Mui-selected': {
    backgroundColor: '#e87722',
    '&, & .MuiListItemIcon-root': {
      color: 'white',
    },
  },
  '&& .Mui-selected:hover': {
    backgroundColor: '#bd5d16',
    '&, & .MuiListItemIcon-root': {
      color: 'white',
    },
  },
  '& .MuiButtonBase-root:hover': {
    backgroundColor: '#eee',
    '&, & .MuiListItemIcon-root': {
      color: '#222',
    },
  },
  '& .MuiButtonBase-root': {
    borderBottom: '1px solid #ccc',
      '&, & .MuiListItemIcon-root': {
        minWidth: '30px',
    },
  },
  '& .MuiListItem-root': {
    fontSize: '14px',
    borderBottom: '1px solid #ccc',
      '&, & .MuiListItemIcon-root': {
        minWidth: '30px',
    },
  },
  '& .MuiListItemText-primary': {
    fontSize: '14px',
    marginTop: '0px',
    marginBottom: '0px',
    fontFamily: 'Helvetica Neue',
  },
  '& .MuiBox-root': {
    '.MuiListItem-root': {
      paddingLeft: '40px',
    }
  },
});

const SideNavbar: React.FC<SideNavBarProps> = () => {
  const theme = useTheme();
  const [open, setOpen] = React.useState(true);
  const filters = useSelector((state: RootStateOrAny) => state.filters)

  const menuItems: Array<MenuItem> = [
    {
      title: 'Find People',
      to: '/search',
      imgUrl: facultyIcon,
      imgUrlActive: facultyIconActive,
      disabled: false,
    },
    {
      title: 'Curate Publications',
      to: '/curate',
      imgUrl: settingsIcon,
      imgUrlActive: settingsIconActive,
      disabled: (Object.keys(filters).length === 0),
    },
    {
      title: 'Create Reports',
      to: '/report',
      imgUrl: chartIcon,
      imgUrlActive: chartIconActive,
      disabled: false,
    },
    {
      title: 'Perform Analysis',
      to: '/login',
      imgUrl: checkMarkIcon,
      imgUrlActive: checkMarkIconActive,
      disabled: false,
    },
    {
      title: 'Manage Module',
      imgUrl: settingsIcon,
      imgUrlActive: settingsIconActive,
      nestedMenu: [{title: 'Manage Users', to: '/admin/manage/users', imgUrl: facultyIcon, imgUrlActive: facultyIconActive, disabled: false,}]
    }
  ]

  const expandNavCotext = React.useContext(ExpandNavContext);

  const handleDrawerToggle = () => {
    expandNavCotext.updateExpand();
    setOpen(!open);
  };

  return (
    <Drawer variant="permanent" className='drawer-container' open={open} theme={theme}>
      <DrawerHeader className={styles.drawerHeader}>
        <div onClick={handleDrawerToggle} className={styles.sidebarControl}>
          {open ? <span className={styles.hideSidebar}>compact mode</span> : ''}
          {open ? <ChevronLeftIcon /> : <ChevronRightIcon /> }
        </div>
      </DrawerHeader>
      <Divider />
      <StyledList>
          {
            menuItems.map((item: MenuItem, index: number) => {
              return item.nestedMenu ? 
                <NestedListItem 
                  header={item.title}
                  menuItems={item.nestedMenu}
                  key={index}
                  imgUrl={item.imgUrl}
                />
                :
                <MenuListItem
                  title={item.title}
                  key={index}
                  id={index}
                  to={item.to}
                  imgUrl={item.imgUrl}
                  imgUrlActive={item.imgUrlActive}
                  disabled={item.disabled}
                />
            })
          }
      </StyledList>
    </Drawer>
  )
}
export default SideNavbar;
