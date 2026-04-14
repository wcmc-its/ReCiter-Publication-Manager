import { getIcon } from '../src/utils/iconRegistry'
import SearchIcon from '@mui/icons-material/Search'
import LocalLibraryIcon from '@mui/icons-material/LocalLibrary'
import AssessmentIcon from '@mui/icons-material/Assessment'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import AccountCircleIcon from '@mui/icons-material/AccountCircle'
import GroupIcon from '@mui/icons-material/Group'
import SettingsIcon from '@mui/icons-material/Settings'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'

describe('iconRegistry', () => {
  describe('getIcon - canonical icon names', () => {
    it('resolves "Search" to SearchIcon', () => {
      expect(getIcon('Search')).toBe(SearchIcon)
    })

    it('resolves "LocalLibrary" to LocalLibraryIcon', () => {
      expect(getIcon('LocalLibrary')).toBe(LocalLibraryIcon)
    })

    it('resolves "Assessment" to AssessmentIcon', () => {
      expect(getIcon('Assessment')).toBe(AssessmentIcon)
    })

    it('resolves "NotificationsActive" to NotificationsActiveIcon', () => {
      expect(getIcon('NotificationsActive')).toBe(NotificationsActiveIcon)
    })

    it('resolves "AccountCircle" to AccountCircleIcon', () => {
      expect(getIcon('AccountCircle')).toBe(AccountCircleIcon)
    })

    it('resolves "Group" to GroupIcon', () => {
      expect(getIcon('Group')).toBe(GroupIcon)
    })

    it('resolves "Settings" to SettingsIcon', () => {
      expect(getIcon('Settings')).toBe(SettingsIcon)
    })
  })

  describe('getIcon - fallback behavior', () => {
    it('returns HelpOutlineIcon for unknown icon name', () => {
      expect(getIcon('UnknownIcon')).toBe(HelpOutlineIcon)
    })

    it('returns HelpOutlineIcon for null', () => {
      expect(getIcon(null)).toBe(HelpOutlineIcon)
    })

    it('returns HelpOutlineIcon for undefined', () => {
      expect(getIcon(undefined)).toBe(HelpOutlineIcon)
    })

    it('returns HelpOutlineIcon for empty string', () => {
      expect(getIcon('')).toBe(HelpOutlineIcon)
    })
  })
})
