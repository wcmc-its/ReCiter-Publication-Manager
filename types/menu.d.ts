import type SvgIcon from '@mui/material/SvgIcon'
import { Url } from 'next/dist/shared/lib/router/router'

type SvgIconComponent = typeof SvgIcon

export type MenuItem = {
  title: string
  to?: Url
  nestedMenu?: Array<MenuItem>
  id?: number
  icon?: SvgIconComponent
  disabled?: boolean
  permissionKey?: string
}
