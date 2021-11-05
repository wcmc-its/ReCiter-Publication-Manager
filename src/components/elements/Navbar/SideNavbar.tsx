import * as React from 'react';
import { styled, useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import MuiDrawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import CssBaseline from '@mui/material/CssBaseline';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import NestedListItem from './NestedListItem';
import { MenuItem } from '../../../../types/menu';
import MenuListItem from './MenuListItem';
import { ExpandNavContext } from './ExpandNavContext';

type SideNavBarProps = {
    items: any
}

type drawer = {
    theme: any,
    open: any
}

const menuItems: Array<MenuItem> = [
  {
    title: 'Find People',
    to: '/search',
  },
  {
    title: 'Curate Publications',
    to: '/search',
  },
  {
    title: 'Create Reports',
    to: '/search',
  },
  {
    title: 'Perform Analysis',
    to: '/search',
  },
  {
    title: 'Manage Module',
    nestedMenu: [{title: 'Manage Content', to: '/search',}]
  }
]

const drawerWidth = 240;

const openedMixin = (theme: any) => ({
  top: 60,
  width: drawerWidth,
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: 'hidden',
});

const closedMixin = (theme: any) => ({
  top: 60,
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  overflowX: 'hidden',
  width: `calc(${theme.spacing(7)} + 1px)`,
  [theme.breakpoints.up('sm')]: {
    width: `calc(${theme.spacing(9)} + 1px)`,
  },
});

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
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

const SideNavbar: React.FC<SideNavBarProps> = () => {
  const theme = useTheme();
  const [open, setOpen] = React.useState(true);

  const expandNavCotext = React.useContext(ExpandNavContext);

  const handleDrawerToggle = () => {
    expandNavCotext.updateExpand();
    setOpen(!open);
  };

  return (
    <Box sx={{ display: 'flex' }}>
    <CssBaseline />
    <Drawer variant="permanent" className='drawer-container' open={open} theme={theme}>
      <DrawerHeader>
        <IconButton onClick={handleDrawerToggle}>
          {open ? 'Compact Mode' : ''}
          {open ? <ChevronLeftIcon /> : <ChevronRightIcon /> }
        </IconButton>
      </DrawerHeader>
      <Divider />
      <List>
          {
            menuItems.map((item: MenuItem, index: number) => {
              return item.nestedMenu ? 
                <NestedListItem 
                  header={item.title}
                  menuItems={item.nestedMenu}
                  key={index}
                />
                :
                <MenuListItem
                  title={item.title}
                  key={index}
                  id={index}
                  to={item.to}
                />
            })
          }
      </List>
    </Drawer>
  </Box>
  )
}
export default SideNavbar;
