import { useMemo } from 'react'
import { useSession } from 'next-auth/client'
import { getPermissionsFromRaw, hasPermission } from '../utils/permissionUtils'

export interface PermissionResource {
  resourceType: string
  resourceKey: string
  displayOrder: number
  icon: string
  label: string
  route: string
  permissionKey?: string
}

export function usePermissions() {
  const [session, loading] = useSession()

  const permissions = useMemo(
    () => getPermissionsFromRaw((session as any)?.data?.permissions),
    [(session as any)?.data?.permissions]
  )

  const permissionResources: PermissionResource[] = useMemo(() => {
    try {
      const raw = (session as any)?.data?.permissionResources
      if (typeof raw === 'string') return JSON.parse(raw)
      return raw || []
    } catch {
      return []
    }
  }, [(session as any)?.data?.permissionResources])

  const check = (key: string) => hasPermission(permissions, key)

  return { permissions, permissionResources, hasPermission: check, session, loading }
}
