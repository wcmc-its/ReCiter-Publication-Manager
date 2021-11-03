export type MenuItem = {
  title: string
  to?: Url
  key?: number
  nestedMenu?: Array<MenuItem>
}