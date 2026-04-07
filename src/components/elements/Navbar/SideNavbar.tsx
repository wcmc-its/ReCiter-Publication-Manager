import * as React from 'react';
import { styled, useTheme } from '@mui/material/styles';
import MuiDrawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
// Custom inline SVG icons matching the design mockup
const NavIcon = ({ children }: { children: React.ReactNode }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ flexShrink: 0 }}>
    {children}
  </svg>
);
const IconSearch = () => <NavIcon><circle cx="6.5" cy="6.5" r="4"/><path d="M11 11l2.5 2.5"/></NavIcon>;
const IconCurate = () => <NavIcon><rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M5 8h6M5 5.5h6M5 10.5h4"/></NavIcon>;
const IconReports = () => <NavIcon><path d="M2 12V4l5-2 5 2v8"/><path d="M7 14V9h2v5"/></NavIcon>;
const IconPerson = () => <NavIcon><circle cx="8" cy="5" r="2.5"/><path d="M3 13c0-2.76 2.24-5 5-5s5 2.24 5 5"/></NavIcon>;
const IconManageUsers = () => <NavIcon><path d="M8 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM3 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM13 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"/><path d="M8 6v2M5.5 11H3.5M10.5 11h2"/></NavIcon>;
const IconConfig = () => <NavIcon><circle cx="8" cy="8" r="2"/><path d="M8 2v1M8 13v1M2 8h1M13 8h1M3.5 3.5l.7.7M11.8 11.8l.7.7M11.8 4.2l-.7.7M4.2 11.8l-.7.7"/></NavIcon>;
import SettingsIconGare from '../../../../public/images/settingsIconGare.png';
import SettingsGareIconActive from '../../../../public/images/settingsWhite.png';
import NestedListItem from './NestedListItem';
import { MenuItem } from '../../../../types/menu';
import MenuListItem from './MenuListItem';
import { ExpandNavContext } from './ExpandNavContext';
import facultyIcon from '../../../../public/images/icon-side-faculty_index.png';
import SettingsIconTools from '../../../../public/images/icon-side-admin_index.png';
import chartIcon from '../../../../public/images/icon-side-faculty_report.png';
import checkMarkIcon from '../../../../public/images/icon-side-check_mark.png';
import styles from './Navbar.module.css'
import facultyIconActive from '../../../../public/images/icon-side-faculty_index-active.png';
import settingsIconActive from '../../../../public/images/icon-side-faculty_admin-active.png';
import chartIconActive from '../../../../public/images/icon-side-faculty_report-active.png';
import checkMarkIconActive from '../../../../public/images/icon-side-check_mark-active.png';
import { useSelector } from "react-redux";
import { RootStateOrAny } from "../../../types/redux";
import { useSession } from 'next-auth/react';
import ScopeLabel from './ScopeLabel';
import { getCapabilities } from '../../../utils/constants';


type SideNavBarProps = {
    items: any
}

type drawer = {
    theme: any,
    open: any
}

const drawerWidth = 220;

const openedMixin = (theme: any) => ({
  top: 0,
  width: drawerWidth,
  height: '100vh',
  paddingTop: '52px',
  zIndex: 999,
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  paddingBottom: '16px',
  backgroundColor: '#1a2133',
  borderRight: 'none',
  boxShadow: 'none',
  display: 'flex',
  flexDirection: 'column' as const,
});

const closedMixin = (theme: any) => ({
  top: 0,
  height: '100vh',
  paddingTop: '52px',
  zIndex: 999,
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
  paddingBottom: '16px',
  backgroundColor: '#1a2133',
  borderRight: '1px solid #2a3350',
  boxShadow: 'none',
  display: 'flex',
  flexDirection: 'column' as const,
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
    // Root element: invisible, takes no space in layout
    width: 0,
    height: 0,
    overflow: 'visible',
    position: 'fixed' as const,
    // Paper element: the actual visible sidebar
    ...(open && {
      '& .MuiDrawer-paper': openedMixin(theme),
    }),
    ...(!open && {
      '& .MuiDrawer-paper': closedMixin(theme),
    }),
  }),
);

const StyledList = styled(List)({
  paddingTop: '0px',
  backgroundColor: '#1a2133',
  // Link wrappers: fill background to prevent subpixel seams
  '& > a': {
    display: 'block',
    backgroundColor: '#1a2133',
  },
  // selected: active bg, white text, red left accent
  '&& .Mui-selected': {
    backgroundColor: '#2d3a52',
    borderLeft: '2px solid #e05a5a',
    color: '#ffffff',
    fontWeight: 500,
    '& .MuiListItemIcon-root': { color: '#ffffff' },
    '& .MuiListItemIcon-root svg': { opacity: 1 },
  },
  '&& .Mui-selected:hover': {
    backgroundColor: '#2d3a52',
    color: '#ffffff',
    '& .MuiListItemIcon-root': { color: '#ffffff' },
  },
  // hover: lighter bg, text goes white
  '& .MuiListItem-root:hover': {
    backgroundColor: '#242e44',
    color: '#ffffff',
    '& .MuiListItemText-primary': { color: '#ffffff' },
    '& .MuiListItemIcon-root': { color: '#ffffff' },
    '& .MuiListItemIcon-root svg': { opacity: 1 },
  },
  '& .MuiListItem-root': {
    color: '#a8b4cc',
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
    padding: '9px 20px',
    backgroundColor: '#1a2133',
    borderTop: 'none',
    borderRight: 'none',
    borderBottom: 'none',
    borderLeft: '2px solid transparent',
    '& .MuiListItemIcon-root': {
      minWidth: '16px',
      color: '#a8b4cc',
      marginRight: '10px',
    },
    '& .MuiListItemIcon-root svg': {
      opacity: 0.7,
    },
  },
  '& .MuiListItemText-root': {
    margin: 0,
    padding: 0,
  },
  '& .MuiListItemText-primary': {
    fontSize: '13px',
    lineHeight: 'normal',
    fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
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

  const [isCurateSelf, setIsCurateSelf] = React.useState(false);
  const [isVisibleNotification, setVisibleNotification] = React.useState(true);


  const { data: session, status } = useSession(); const loading = status === "loading";

  const userPermissions = JSON.parse(session.data.userRoles);
  const isSuperuser = userPermissions.some((role: any) => role.roleLabel === "Superuser");

  // Phase 9: Parse scope/proxy data and derive capabilities
  const scopeData = session?.data?.scopeData ? JSON.parse(session.data.scopeData) : null;
  const proxyPersonIds = session?.data?.proxyPersonIds ? JSON.parse(session.data.proxyPersonIds) : [];
  const caps = getCapabilities(userPermissions);
  const isScopedCurator = caps.canCurate.scoped && !caps.canCurate.all;

  const menuItems: Array<MenuItem> = [
    {
      title: 'Find People',
      to: '/search',
      imgUrl: facultyIcon,
      imgUrlActive: facultyIconActive,
      muiIcon: <IconSearch />,
      disabled: false,
      allowedRoleNames: ["Superuser", "Curator_All","Reporter_All","Curator_Scoped"],
      isRequired:true
    },
    {
      title: 'Curate Publications',
      to: '/curate',
      imgUrl: SettingsIconTools,
      imgUrlActive: settingsIconActive,
      muiIcon: <IconCurate />,
      disabled: isSuperuser ? false : (Object.keys(filters).length === 0),
      allowedRoleNames: ["Superuser", "Curator_All","Curator_Self","Curator_Scoped"],
      isRequired:true
    },
    {
      title: 'Create Reports',
      to: '/report',
      imgUrl: chartIcon,
      imgUrlActive: chartIconActive,
      muiIcon: <IconReports />,
      disabled: false,
      allowedRoleNames: ["Superuser","Reporter_All" ],
      isRequired:true
    },
    {
      title: 'Manage Notifications',
      to: `/notifications/${session.data.username}`,
      imgUrl: chartIcon,
      imgUrlActive: chartIconActive,
      muiIcon: <IconCurate />,
      disabled: false,
      allowedRoleNames: ["Department_user","Curator_Self","Superuser", "Curator_All"],
      isRequired: isSuperuser ? true : (isVisibleNotification && session.data.email ? true : false)
    },
    {
      title: 'Manage Profile',
      to: `/manageprofile/${session.data.username}`,
      imgUrl: chartIcon,
      imgUrlActive: chartIconActive,
      muiIcon: <IconPerson />,
      disabled: false,
      allowedRoleNames: ["Department_user","Curator_Self","Superuser", "Curator_All"],
      isRequired: true
    },
    {title: 'Manage Users',
      to: '/manageusers',
      imgUrl: facultyIcon,
      imgUrlActive: facultyIconActive,
      muiIcon: <IconManageUsers />,
      disabled: false,
      allowedRoleNames: ["Superuser"],
      isRequired:true
    },
    {title: 'Configuration',
    to: '/configuration',
    imgUrl: SettingsIconGare,
    imgUrlActive: SettingsGareIconActive,
    muiIcon: <IconConfig />,
    disabled: false,
    allowedRoleNames: ["Superuser"],
    isRequired:true
  },
    // {
    //   title: 'Manage Users',
    //   to: '/manageUsers',
    //   imgUrl: chartIcon,
    //   imgUrlActive: chartIconActive,
    //   disabled: false,
    //   allowedRoleNames: ["Superuser","" ],
    // },
    // {
    //   title: 'Perform Analysis',
    //   to: '/login',
    //   imgUrl: checkMarkIcon,
    //   imgUrlActive: checkMarkIconActive,
    //   disabled: false,
    //   allowedRoleNames: ["Superuser","Reporter_All" ],
    // },
  //   {
  //     title: 'Manage Module',
  //     imgUrl: SettingsIconTools,
  //     imgUrlActive: settingsIconActive,
  //     nestedMenu: [{title: 'Manage Users', 
  //     to: '/admin/manage/users', 
  //     imgUrl: facultyIcon, 
  //     imgUrlActive: facultyIconActive, 
  //     disabled: false,
  //     allowedRoleNames: ["Superuser"],
  //   },
  //   {title: 'Settings', 
  //   to: '/admin/manage/settings', 
  //   imgUrl: SettingsIconGare, 
  //   imgUrlActive: SettingsGareIconActive, 
  //   disabled: false,
  //   allowedRoleNames: ["Superuser"],
  // }],
  //     allowedRoleNames: ["Superuser"],

  //   }
  ]

  const expandNavCotext = React.useContext(ExpandNavContext);

  const handleDrawerToggle = () => {
    expandNavCotext.updateExpand();
    setOpen(!open);
  };
  

  React.useEffect(()=>{
    var manageNotifications = [];
    if (updatedAdminSettings.length > 0) {
      let updatedData = updatedAdminSettings.find(obj => obj.viewName === "EmailNotifications")
      manageNotifications = updatedData?.viewAttributes || [];
    } else if (session?.adminSettings) {
      let adminSettings = JSON.parse(JSON.stringify(session.adminSettings));
      let data = JSON.parse(adminSettings).find(obj => obj.viewName === "EmailNotifications")
      manageNotifications = data ? JSON.parse(data.viewAttributes) : [];
    }
    let settingsObj = manageNotifications.find(data=> data.isVisible)
    setVisibleNotification(settingsObj && settingsObj.isVisible || false)
  },[])

  // Re-derive notification visibility when admin settings arrive in Redux (async)
  React.useEffect(() => {
    if (updatedAdminSettings && updatedAdminSettings.length > 0) {
      let updatedData = updatedAdminSettings.find(obj => obj.viewName === "EmailNotifications")
      let manageNotifications = updatedData?.viewAttributes || [];
      let settingsObj = manageNotifications.find(data => data.isVisible)
      setVisibleNotification(settingsObj && settingsObj.isVisible || false)
    }
  }, [updatedAdminSettings])

  return (
    <Drawer variant="permanent" className='drawer-container' open={open} theme={theme}>
      <StyledList sx={{ flexGrow: 1, paddingTop: '16px' }}>
          {open && (
            <Typography sx={{ padding: '12px 20px 6px', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(168,180,204,0.4)' }}>
              Navigation
            </Typography>
          )}
          {isScopedCurator && open && (
            <ScopeLabel
              scopeData={scopeData}
              proxyCount={proxyPersonIds.length}
            />
          )}
          {
            menuItems.slice(0, 5).map((item: MenuItem, index: number) => {
              const matchedRoles = userPermissions.filter(role => item.allowedRoleNames.includes(role.roleLabel));
              if(matchedRoles.length >= 1 && item.isRequired){
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
                  muiIcon={item.muiIcon}
                  disabled={item.disabled}
                />
              }
            })
          }
          {open && (
            <Typography sx={{ padding: '12px 20px 6px', marginTop: '8px', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(168,180,204,0.4)' }}>
              Admin
            </Typography>
          )}
          {
            menuItems.slice(5).map((item: MenuItem, index: number) => {
              const matchedRoles = userPermissions.filter(role => item.allowedRoleNames.includes(role.roleLabel));
              if(matchedRoles.length >= 1 && item.isRequired){
              return item.nestedMenu ?
                <NestedListItem
                  header={item.title}
                  menuItems={item.nestedMenu}
                  key={index + 5}
                  imgUrl={item.imgUrl}
                />
                :
                <MenuListItem
                  title={item.title}
                  key={index + 5}
                  id={index + 5}
                  to={item.to}
                  imgUrl={item.imgUrl}
                  imgUrlActive={item.imgUrlActive}
                  muiIcon={item.muiIcon}
                  disabled={item.disabled}
                />
              }
            })
          }
      </StyledList>
      <button type="button" className={styles.compactToggle} onClick={handleDrawerToggle} style={{ marginTop: 'auto', borderTop: '1px solid #2a3350', background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', width: '100%' }} aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}>
        {open && <span>Compact mode</span>}
        {open ? <ChevronLeftIcon sx={{ fontSize: 16, color: '#4a5568' }} /> : <ChevronRightIcon sx={{ fontSize: 16, color: '#4a5568' }} />}
      </button>
    </Drawer>
  )
}
export default SideNavbar;
