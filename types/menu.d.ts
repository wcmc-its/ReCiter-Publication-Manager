export type MenuItem = {
  title: string
  to?: Url
  nestedMenu?: Array<MenuItem>
  id?: number
  imgUrl?: string | StaticImport
  imgUrlActive?: string | StaticImport
  muiIcon?: any
  disabled?: boolean
  allowedRoleNames?:Array,
  isRequired?:boolean
  capabilityKey?: string
}