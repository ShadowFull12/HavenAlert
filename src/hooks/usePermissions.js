import { useMemo } from 'react';
import useVenueStore from '../store/venueStore';

export function usePermissions() {
  const { staffMember, staffGroup } = useVenueStore();

  const effectivePermissions = useMemo(() => {
    if (!staffMember) return [];
    const groupPerms = staffGroup?.permissions || [];
    const customPerms = staffMember.custom_permissions || [];
    return [...new Set([...groupPerms, ...customPerms])];
  }, [staffMember, staffGroup]);

  const can = (permission) => {
    if (!staffMember) return false;
    if (staffMember.role === 'owner') return true;
    if (staffMember.role === 'manager') return true;
    return effectivePermissions.includes(permission);
  };

  return { can, effectivePermissions };
}
