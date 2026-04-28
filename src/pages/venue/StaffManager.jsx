import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  UserPlus, Users, Shield, Key, Settings2, Trash2,
  ChevronDown, ChevronUp, Check, X, Edit2, Save, Copy, Link as LinkIcon
} from 'lucide-react';
import useVenueStore from '../../store/venueStore';
import useAuthStore from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { usePermissions } from '../../hooks/usePermissions';
import StaffInviteModal from '../../components/venue/StaffInviteModal';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const ALL_PERMISSIONS = [
  { key: 'view_incidents',    label: 'View Incidents',    category: 'Incidents' },
  { key: 'manage_incidents',  label: 'Manage Incidents',  category: 'Incidents' },
  { key: 'delete_incidents',  label: 'Delete Incidents',  category: 'Incidents' },
  { key: 'view_complaints',   label: 'View Complaints',   category: 'Complaints' },
  { key: 'manage_complaints', label: 'Manage Complaints', category: 'Complaints' },
  { key: 'delete_complaints', label: 'Delete Complaints', category: 'Complaints' },
  { key: 'view_guests',       label: 'View Guests',       category: 'Guests' },
  { key: 'manage_guests',     label: 'Manage Guests',     category: 'Guests' },
  { key: 'view_rooms',        label: 'View Rooms',        category: 'Rooms' },
  { key: 'manage_rooms',      label: 'Manage Rooms',      category: 'Rooms' },
  { key: 'view_staff',        label: 'View Staff',        category: 'Administration' },
  { key: 'manage_staff',      label: 'Manage Staff',      category: 'Administration' },
  { key: 'view_analytics',    label: 'View Analytics',    category: 'Administration' },
  { key: 'manage_venue',      label: 'Manage Venue',      category: 'Administration' },
];

const PERM_CATEGORIES = ['Incidents', 'Complaints', 'Guests', 'Rooms', 'Administration'];

const TABS = ['members', 'roles', 'invites'];

export default function StaffManager() {
  const { venue } = useVenueStore();
  const { profile: myProfile } = useAuthStore();
  const { can } = usePermissions();
  const canManageStaff = can('manage_staff');
  const [tab, setTab] = useState('members');
  const [staffList, setStaffList] = useState([]);
  const [groups, setGroups] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [groupForm, setGroupForm] = useState({ name: '', description: '', permissions: [], color: '#6366f1' });
  const [expandedStaff, setExpandedStaff] = useState(null);
  const [staffPermOverrides, setStaffPermOverrides] = useState({});
  const [savingPermId, setSavingPermId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const channelRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!venue?.id) return;
    fetchAll();
    subscribeToChanges();
  }, [venue?.id]);

  const subscribeToChanges = () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    const ch = supabase
      .channel(`staff-manager-${venue.id}-${Date.now()}`)
      // New staff joins via invite code
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'staff_members',
        filter: `venue_id=eq.${venue.id}`,
      }, () => { if (mountedRef.current) fetchAll(); })
      // Staff member updated (role, active status, permissions)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'staff_members',
        filter: `venue_id=eq.${venue.id}`,
      }, () => { if (mountedRef.current) fetchAll(); })
      // Staff member removed
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'staff_members',
        filter: `venue_id=eq.${venue.id}`,
      }, () => { if (mountedRef.current) fetchAll(); })
      // Invite code used/created
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'staff_invites',
        filter: `venue_id=eq.${venue.id}`,
      }, () => { if (mountedRef.current) fetchAll(); })
      // Role groups changed
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'staff_groups',
        filter: `venue_id=eq.${venue.id}`,
      }, () => { if (mountedRef.current) fetchAll(); })
      .subscribe();
    channelRef.current = ch;
  };

  const fetchAll = async () => {
    const [s, g, i] = await Promise.all([
      supabase.from('staff_members')
        .select('*, profile:profiles(id, full_name, role), group:staff_groups(id, name, color, permissions)')
        .eq('venue_id', venue.id)
        .order('joined_at', { ascending: false }),
      supabase.from('staff_groups').select('*').eq('venue_id', venue.id),
      supabase.from('staff_invites').select('*').eq('venue_id', venue.id).order('created_at', { ascending: false }),
    ]);
    if (s.error) console.error('staff_members fetch error:', s.error);
    if (g.error) console.error('staff_groups fetch error:', g.error);
    if (i.error) console.error('staff_invites fetch error:', i.error);
    setStaffList(s.data || []);
    setGroups(g.data || []);
    setInvites(i.data || []);
    setLoading(false);

    // Initialize override state
    const overrides = {};
    for (const sm of s.data || []) {
      overrides[sm.id] = sm.custom_permissions || [];
    }
    setStaffPermOverrides(overrides);
  };

  const getEffectivePermissions = (sm) => {
    const groupPerms = sm.group?.permissions || [];
    const overrides = staffPermOverrides[sm.id] || sm.custom_permissions || [];
    const all = new Set([...groupPerms, ...overrides]);
    return Array.from(all);
  };

  const toggleStaffPermOverride = (smId, perm) => {
    setStaffPermOverrides(prev => {
      const current = prev[smId] || [];
      const updated = current.includes(perm) ? current.filter(p => p !== perm) : [...current, perm];
      return { ...prev, [smId]: updated };
    });
  };

  const saveStaffPermissions = async (smId) => {
    setSavingPermId(smId);
    const { error } = await supabase.from('staff_members')
      .update({ custom_permissions: staffPermOverrides[smId] || [] })
      .eq('id', smId);
    if (error) toast.error(error.message);
    else toast.success('Permissions saved');
    setSavingPermId(null);
  };

  const assignGroup = async (smId, groupId) => {
    const { error } = await supabase.from('staff_members')
      .update({ group_id: groupId || null }).eq('id', smId);
    if (error) toast.error(error.message);
    else { toast.success('Role updated'); fetchAll(); }
  };

  const toggleStaffActive = async (smId, current) => {
    await supabase.from('staff_members').update({ is_active: !current }).eq('id', smId);
    fetchAll();
    toast.success(!current ? 'Staff activated' : 'Staff deactivated');
  };

  const removeStaff = async (smId) => {
    if (!confirm('Remove this staff member?')) return;
    await supabase.from('staff_members').delete().eq('id', smId);
    fetchAll();
    toast.success('Staff removed');
  };

  const openCreateGroup = () => {
    setEditingGroup(null);
    setGroupForm({ name: '', description: '', permissions: [], color: '#6366f1' });
    setShowGroupModal(true);
  };

  const openEditGroup = (g) => {
    setEditingGroup(g);
    setGroupForm({ name: g.name, description: g.description || '', permissions: g.permissions || [], color: g.color || '#6366f1' });
    setShowGroupModal(true);
  };

  const saveGroup = async (e) => {
    e.preventDefault();
    if (!groupForm.name.trim()) return;
    setSubmitting(true);
    try {
      if (editingGroup) {
        await supabase.from('staff_groups')
          .update({ name: groupForm.name, description: groupForm.description, permissions: groupForm.permissions, color: groupForm.color })
          .eq('id', editingGroup.id);
        toast.success('Role updated');
      } else {
        await supabase.from('staff_groups')
          .insert({ venue_id: venue.id, name: groupForm.name, description: groupForm.description, permissions: groupForm.permissions, color: groupForm.color });
        toast.success('Role created');
      }
      setShowGroupModal(false);
      fetchAll();
    } catch (err) { toast.error(err.message); }
    finally { setSubmitting(false); }
  };

  const deleteGroup = async (id) => {
    if (!confirm('Delete this role? Staff in this role will lose its permissions.')) return;
    await supabase.from('staff_groups').delete().eq('id', id);
    fetchAll();
    toast.success('Role deleted');
  };

  const togglePerm = (perm) => {
    setGroupForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(perm) ? prev.permissions.filter(p => p !== perm) : [...prev.permissions, perm]
    }));
  };

  if (loading) return <Spinner className="py-16" size="lg" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-haven-dark">Staff Management</h1>
          <p className="text-sm text-haven-muted mt-0.5">Manage staff roles and permissions</p>
        </div>
        <div className="flex gap-2">
          {tab === 'members' && canManageStaff && <Button onClick={() => setShowInvite(true)} className="text-sm"><UserPlus className="w-4 h-4" /> Invite Staff</Button>}
          {tab === 'roles' && canManageStaff && <Button onClick={openCreateGroup} className="text-sm"><Shield className="w-4 h-4" /> New Role</Button>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {[['members', 'Members', staffList.length], ['roles', 'Roles', groups.length], ['invites', 'Invites', invites.length]].map(([id, label, count]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all min-h-[36px] flex items-center justify-center gap-1.5 ${tab === id ? 'bg-white text-haven-dark shadow-sm' : 'text-haven-muted'}`}>
            {label}
            {count > 0 && <span className="text-xs bg-gray-200 text-gray-600 rounded-full px-1.5 leading-4">{count}</span>}
          </button>
        ))}
      </div>

      {/* ── Members Tab ─────────────────────────────────────────────────────── */}
      {tab === 'members' && (
        staffList.length === 0 ? (
          <EmptyState icon={Users} title="No staff yet" message="Invite staff to join your venue." action="Invite Staff" onAction={() => setShowInvite(true)} />
        ) : (
          <div className="space-y-2">
            {staffList.map(sm => {
              const effectivePerms = getEffectivePermissions(sm);
              const isExpanded = expandedStaff === sm.id;
              const groupPerms = sm.group?.permissions || [];

              return (
                <div key={sm.id} className="card overflow-hidden">
                  {/* Header row */}
                  <div className="p-4 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
                        style={{ backgroundColor: sm.group?.color || '#6366f1' }}>
                        {sm.profile?.full_name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-haven-dark">{sm.profile?.full_name || 'Staff'}</p>
                        <p className="text-xs text-haven-muted capitalize">
                          {sm.role}
                          {sm.group?.name && <span className="ml-1 px-1.5 py-0.5 rounded text-white text-[10px]" style={{ backgroundColor: sm.group.color }}>{sm.group.name}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={sm.is_active ? 'success' : 'low'}>{sm.is_active ? 'Active' : 'Inactive'}</Badge>
                      {canManageStaff && (
                        <button onClick={() => toggleStaffActive(sm.id, sm.is_active)}
                          className="text-xs text-haven-muted hover:text-haven-dark px-2 py-1 rounded hover:bg-gray-100">
                          {sm.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                      {canManageStaff && sm.role !== 'owner' && sm.profile?.id !== myProfile?.id && (
                        <button onClick={() => removeStaff(sm.id)} className="p-1.5 rounded hover:bg-red-50 text-haven-muted hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      {canManageStaff && (
                        <button onClick={() => setExpandedStaff(isExpanded ? null : sm.id)}
                          className="p-1.5 rounded hover:bg-gray-100 text-haven-muted">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <Settings2 className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded permissions panel */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 p-4 space-y-4 bg-gray-50">
                      {/* Role assignment */}
                      <div>
                        <label className="text-xs font-semibold text-haven-muted uppercase tracking-wider block mb-2">Assign Role</label>
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => assignGroup(sm.id, null)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${!sm.group_id ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-haven-muted border-gray-200 hover:border-gray-400'}`}>
                            No Role
                          </button>
                          {groups.map(g => (
                            <button key={g.id} onClick={() => assignGroup(sm.id, g.id)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${sm.group_id === g.id ? 'text-white border-transparent' : 'bg-white text-haven-muted border-gray-200 hover:border-gray-400'}`}
                              style={sm.group_id === g.id ? { backgroundColor: g.color, borderColor: g.color } : {}}>
                              {g.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Per-member permission overrides (Discord-style) */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-semibold text-haven-muted uppercase tracking-wider">Permission Overrides</label>
                          <p className="text-[10px] text-haven-muted">Grant or deny beyond role defaults</p>
                        </div>
                        {PERM_CATEGORIES.map(cat => {
                          const catPerms = ALL_PERMISSIONS.filter(p => p.category === cat);
                          return (
                            <div key={cat} className="mb-3">
                              <p className="text-[10px] font-semibold text-haven-muted uppercase tracking-wider mb-1.5">{cat}</p>
                              <div className="grid grid-cols-2 gap-1.5">
                                {catPerms.map(({ key, label }) => {
                                  const fromRole = groupPerms.includes(key);
                                  const overridden = (staffPermOverrides[sm.id] || []).includes(key);
                                  const effective = fromRole || overridden;
                                  return (
                                    <label key={key}
                                      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-all border ${effective ? 'bg-green-50 border-green-200 text-green-800' : 'bg-white border-gray-200 text-haven-muted'}`}>
                                      <input type="checkbox" checked={overridden} onChange={() => toggleStaffPermOverride(sm.id, key)} className="rounded accent-green-600 w-3.5 h-3.5" />
                                      <span className="flex-1">{label}</span>
                                      {fromRole && !overridden && <span className="text-[9px] text-blue-500 font-bold">ROLE</span>}
                                      {overridden && <span className="text-[9px] text-green-600 font-bold">+EXTRA</span>}
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                        <div className="flex items-center gap-2 mt-2">
                          <p className="text-[10px] text-haven-muted">Effective permissions: <strong>{effectivePerms.length}</strong> / {ALL_PERMISSIONS.length}</p>
                          <Button onClick={() => saveStaffPermissions(sm.id)} loading={savingPermId === sm.id} className="ml-auto text-xs py-1.5 px-3">
                            <Save className="w-3.5 h-3.5" /> Save Overrides
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── Roles Tab ───────────────────────────────────────────────────────── */}
      {tab === 'roles' && (
        groups.length === 0 ? (
          <EmptyState icon={Shield} title="No roles yet" message="Create roles with specific permissions to assign to staff." action="New Role" onAction={openCreateGroup} />
        ) : (
          <div className="space-y-3">
            {groups.map(g => (
              <div key={g.id} className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: g.color }} />
                    <h4 className="font-semibold text-sm text-haven-dark">{g.name}</h4>
                    <span className="text-xs text-haven-muted">— {(g.permissions || []).length} permissions</span>
                  </div>
                  {canManageStaff && (
                    <div className="flex gap-1">
                      <button onClick={() => openEditGroup(g)} className="p-1.5 rounded hover:bg-gray-100 text-haven-muted hover:text-haven-dark">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteGroup(g.id)} className="p-1.5 rounded hover:bg-red-50 text-haven-muted hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
                {g.description && <p className="text-xs text-haven-muted mb-2">{g.description}</p>}
                <div className="flex flex-wrap gap-1.5">
                  {(g.permissions || []).map(p => (
                    <span key={p} className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-700">
                      {p.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
                <p className="text-[10px] text-haven-muted mt-2">
                  {staffList.filter(sm => sm.group_id === g.id).length} member(s) in this role
                </p>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Invites Tab ─────────────────────────────────────────────────────── */}
      {tab === 'invites' && (
        <div className="space-y-4">
          {/* Onboarding instructions */}
          <div className="card p-4 bg-blue-50 border-blue-100">
            <p className="text-sm font-semibold text-blue-900 mb-1">🔗 How to onboard a new staff member</p>
            <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
              <li>Click <strong>Generate Invite</strong> to create a one-time code</li>
              <li>Share the code + this link with the new hire:<br />
                <span className="font-mono bg-blue-100 px-1.5 py-0.5 rounded text-blue-800 break-all">
                  {window.location.origin}/auth/staff-register
                </span>
              </li>
              <li>They create an account and enter the code to join your venue</li>
              <li>Once joined, assign them a role from the <strong>Members</strong> tab</li>
            </ol>
          </div>

          {invites.length === 0 ? (
            <EmptyState icon={Key} title="No invite codes" message="Generate invite codes to onboard new staff members." action={canManageStaff ? "Generate Invite" : undefined} onAction={canManageStaff ? () => setShowInvite(true) : undefined} />
          ) : (
            <div className="space-y-2">
              {invites.map(inv => (
                <div key={inv.id} className="card p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-mono font-bold text-lg text-haven-dark tracking-widest">{inv.code}</p>
                        {!inv.used_by && (
                          <button
                            onClick={() => { navigator.clipboard.writeText(inv.code); toast.success('Code copied!'); }}
                            className="p-1 rounded hover:bg-gray-100 text-haven-muted hover:text-haven-dark"
                            title="Copy code"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-haven-muted capitalize mt-0.5">
                        {inv.role} · Expires {inv.expires_at ? format(new Date(inv.expires_at), 'MMM d, yyyy HH:mm') : 'never'}
                      </p>
                    </div>
                    <Badge variant={inv.used_by ? 'success' : 'warning'}>{inv.used_by ? 'Used' : 'Pending'}</Badge>
                  </div>
                  {!inv.used_by && (
                    <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2">
                      <LinkIcon className="w-3 h-3 text-haven-muted flex-shrink-0" />
                      <p className="text-[11px] text-haven-muted">
                        Share: <span className="font-mono">{window.location.origin}/auth/staff-register</span> + code <strong>{inv.code}</strong>
                      </p>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`Register at ${window.location.origin}/auth/staff-register and use invite code: ${inv.code}`);
                          toast.success('Invite message copied!');
                        }}
                        className="ml-auto text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
                      >
                        Copy message
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <StaffInviteModal isOpen={showInvite} onClose={() => { setShowInvite(false); fetchAll(); }} />

      {/* Create / Edit Role Modal */}
      <Modal isOpen={showGroupModal} onClose={() => setShowGroupModal(false)} title={editingGroup ? `Edit Role: ${editingGroup.name}` : 'Create New Role'}>
        <form onSubmit={saveGroup} className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <Input label="Role Name" placeholder="e.g., Front Desk" value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-haven-muted">Color</label>
              <input type="color" value={groupForm.color} onChange={(e) => setGroupForm({ ...groupForm, color: e.target.value })}
                className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-1" />
            </div>
          </div>
          <Input label="Description (optional)" placeholder="Brief description of this role" value={groupForm.description} onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })} />

          <div>
            <label className="text-xs font-semibold text-haven-muted uppercase tracking-wider block mb-2">Permissions</label>
            {PERM_CATEGORIES.map(cat => {
              const catPerms = ALL_PERMISSIONS.filter(p => p.category === cat);
              const allChecked = catPerms.every(p => groupForm.permissions.includes(p.key));
              return (
                <div key={cat} className="mb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[11px] font-semibold text-haven-muted uppercase tracking-wider">{cat}</p>
                    <button type="button" onClick={() => {
                      if (allChecked) {
                        setGroupForm(prev => ({ ...prev, permissions: prev.permissions.filter(p => !catPerms.find(cp => cp.key === p)) }));
                      } else {
                        setGroupForm(prev => ({ ...prev, permissions: [...new Set([...prev.permissions, ...catPerms.map(p => p.key)])] }));
                      }
                    }} className="text-[10px] text-blue-500 hover:text-blue-700 font-medium">
                      {allChecked ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {catPerms.map(({ key, label }) => (
                      <label key={key} className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs cursor-pointer border transition-all ${groupForm.permissions.includes(key) ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-gray-50 border-gray-200 text-haven-muted hover:border-gray-300'}`}>
                        <input type="checkbox" checked={groupForm.permissions.includes(key)} onChange={() => togglePerm(key)} className="rounded accent-blue-600 w-3.5 h-3.5" />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowGroupModal(false)} className="flex-1">Cancel</Button>
            <Button type="submit" loading={submitting} className="flex-1">{editingGroup ? 'Save Changes' : 'Create Role'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
