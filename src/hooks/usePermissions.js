import { useMemo } from 'react';
import useVenueStore from '../store/venueStore';

export function usePermissions() {
  const { staffMember, staffGroup } = useVenueStore();

  const effectivePermissions = useMemo(() => {
    if (!staffMember) return [];
    // Owner gets everything automatically — no need to enumerate
    if (staffMember.role === 'owner') return ['__owner__'];
    const groupPerms = staffGroup?.permissions || [];
    const customPerms = staffMember.custom_permissions || [];
    return [...new Set([...groupPerms, ...customPerms])];
  }, [staffMember, staffGroup]);

  const can = (permission) => {
    if (!staffMember) return false;
    // Only owners get automatic full access
    if (staffMember.role === 'owner') return true;
    // Everyone else (manager, staff) must have the permission explicitly
    return effectivePermissions.includes(permission);
  };

  const isOwner = staffMember?.role === 'owner';
  const isManager = staffMember?.role === 'manager';

  return { can, effectivePermissions, isOwner, isManager };
}
