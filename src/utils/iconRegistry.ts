import SearchIcon from '@mui/icons-material/Search'
import LocalLibraryIcon from '@mui/icons-material/LocalLibrary'
import AssessmentIcon from '@mui/icons-material/Assessment'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import AccountCircleIcon from '@mui/icons-material/AccountCircle'
import GroupIcon from '@mui/icons-material/Group'
import SettingsIcon from '@mui/icons-material/Settings'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import type SvgIcon from '@mui/material/SvgIcon'

type SvgIconComponent = typeof SvgIcon

const iconRegistry: Record<string, SvgIconComponent> = {
  Search: SearchIcon,
  LocalLibrary: LocalLibraryIcon,
  Assessment: AssessmentIcon,
  NotificationsActive: NotificationsActiveIcon,
  AccountCircle: AccountCircleIcon,
  Group: GroupIcon,
  Settings: SettingsIcon,
}

export function getIcon(name: string | null | undefined): SvgIconComponent {
  if (!name) return HelpOutlineIcon
  return iconRegistry[name] || HelpOutlineIcon
}

export { iconRegistry }
