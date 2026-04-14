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
import styles from './Navbar.module.css'
import { useSelector, RootStateOrAny } from "react-redux";
import { usePermissions, PermissionResource } from '../../../hooks/usePermissions'
import { getIcon } from '../../../utils/iconRegistry'
import { hasPermission } from '../../../utils/permissionUtils'


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
  '& .MuiBox-root': {
    '.MuiListItem-root': {
      paddingLeft: '27px',
    }
  },
  '& .MuiListItemText-root': {
    display: 'none'
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
  const updatedAdminSettings = useSelector((state: RootStateOrAny) => state.updatedAdminSettings)

  const [isVisibleNotification, setVisibleNotification] = React.useState(true);

  const { permissions, permissionResources, session, loading } = usePermissions()

  const navItems = React.useMemo(() => {
    return permissionResources
      .filter((r: PermissionResource) => r.resourceType === 'nav')
      .sort((a: PermissionResource, b: PermissionResource) => a.displayOrder - b.displayOrder)
  }, [permissionResources])

  const expandNavCotext = React.useContext(ExpandNavContext);

  const handleDrawerToggle = () => {
    expandNavCotext.updateExpand();
    setOpen(!open);
  };


  React.useEffect(()=>{
    let adminSettings = JSON.parse(JSON.stringify(session?.adminSettings));
    var manageNotifications = [];
    if (updatedAdminSettings.length > 0) {
      let updatedData = updatedAdminSettings.find(obj => obj.viewName === "EmailNotifications")
      manageNotifications = updatedData.viewAttributes;
    }else {
      let data = JSON.parse(adminSettings).find(obj => obj.viewName === "EmailNotifications")
      manageNotifications = JSON.parse(data.viewAttributes);
    }
    let settingsObj = manageNotifications.find(data=> data.isVisible)
    setVisibleNotification(settingsObj && settingsObj.isVisible || false)
  },[])

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
            navItems.map((item: PermissionResource, index: number) => {
              // D-07: Permission controls visibility -- hidden if user lacks permission
              if (!hasPermission(permissions, item.permissionKey)) return null

              // D-08: Manage Notifications triple-check
              if (item.resourceKey === 'nav_notifications') {
                if (!isVisibleNotification || !session?.data?.email) return null
              }

              // Route adjustments for user-specific pages
              let route = item.route
              if (item.resourceKey === 'nav_curate' && Object.keys(filters).length > 0) {
                route = `/curate/${filters.personIdentifier || (session as any)?.data?.username || ''}`
              }
              if (item.resourceKey === 'nav_notifications') {
                route = `/notifications/${(session as any)?.data?.username}`
              }
              if (item.resourceKey === 'nav_profile') {
                route = `/manageprofile/${(session as any)?.data?.username}`
              }

              // D-07: Application state controls disabled
              const disabled = item.resourceKey === 'nav_curate' && Object.keys(filters).length === 0

              const IconComponent = getIcon(item.icon)

              return (
                <MenuListItem
                  title={item.label}
                  key={item.resourceKey}
                  id={index}
                  to={route}
                  icon={IconComponent}
                  disabled={disabled}
                />
              )
            })
          }
      </StyledList>
    </Drawer>
  )
}
export default SideNavbar;
