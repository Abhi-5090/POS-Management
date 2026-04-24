import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Pencil, UserX, UserCheck, ShieldCheck, KeyRound } from 'lucide-react';
import clsx from 'clsx';

import PageHeader from '../../components/admin/PageHeader';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import DataTable from '../../components/admin/DataTable';
import { Field, TextInput, Select, Toggle } from '../../components/admin/FormField';
import { authApi } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import { USER_ROLE } from '../../utils/constants';
import { formatDate } from '../../utils/format';

const ROLE_LABEL = {
  admin: 'Admin',
  cashier: 'Cashier',
  kitchen: 'Kitchen',
  waiter: 'Waiter',
};
const ROLE_COLOR = {
  admin: 'bg-brand-500/20 text-brand-100 border-brand-500/30',
  cashier: 'bg-flame-500/20 text-flame-400 border-flame-500/30',
  kitchen: 'bg-leaf-500/20 text-leaf-500 border-leaf-500/30',
  waiter: 'bg-slate-500/20 text-slate-200 border-slate-500/30',
};

export default function StaffPage() {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const [modal, setModal] = useState({ open: false, user: null });
  const [pwdModal, setPwdModal] = useState({ open: false, user: null });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: authApi.listUsers,
  });

  const save = useMutation({
    mutationFn: (payload) =>
      payload._id
        ? authApi.updateUser(payload._id, stripId(payload))
        : authApi.createUser(stripId(payload)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User saved');
      setModal({ open: false, user: null });
    },
    onError: (e) => toast.error(e.message || 'Save failed'),
  });

  const deactivate = useMutation({
    mutationFn: (id) => authApi.deactivateUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User deactivated');
    },
    onError: (e) => toast.error(e.message || 'Action failed'),
  });

  const reactivate = useMutation({
    mutationFn: (id) => authApi.updateUser(id, { isActive: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User reactivated');
    },
    onError: (e) => toast.error(e.message || 'Action failed'),
  });

  const changePassword = useMutation({
    mutationFn: ({ id, password }) => authApi.updateUser(id, { password }),
    onSuccess: () => {
      toast.success('Password updated');
      setPwdModal({ open: false, user: null });
    },
    onError: (e) => toast.error(e.message || 'Password change failed'),
  });

  return (
    <>
      <PageHeader
        title="Staff"
        subtitle={`${users.length} user${users.length === 1 ? '' : 's'} · ${users.filter((u) => u.isActive).length} active`}
        actions={
          <Button
            variant="blue"
            size="sm"
            icon={Plus}
            onClick={() => setModal({ open: true, user: null })}
          >
            New user
          </Button>
        }
      />

      <div className="pos-panel p-5">
        <DataTable
          loading={isLoading}
          rows={users}
          emptyTitle="No users yet"
          columns={[
            {
              key: 'name',
              label: 'Name',
              render: (u) => (
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-panel-900 border border-white/10 flex items-center justify-center text-slate-300 font-bold">
                    {u.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-white font-semibold truncate">
                      {u.name}
                      {me?._id === u._id && (
                        <span className="ml-2 pos-chip bg-brand-500/15 text-brand-100 border border-brand-500/30">
                          you
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 truncate">
                      @{u.username}
                    </div>
                  </div>
                </div>
              ),
            },
            {
              key: 'role',
              label: 'Role',
              render: (u) => (
                <span className={clsx('pos-chip border', ROLE_COLOR[u.role])}>
                  <ShieldCheck size={12} className="mr-1" />
                  {ROLE_LABEL[u.role] || u.role}
                </span>
              ),
            },
            {
              key: 'status',
              label: 'Status',
              render: (u) => (
                <span
                  className={clsx(
                    'pos-chip border',
                    u.isActive
                      ? 'bg-leaf-500/15 text-leaf-500 border-leaf-500/30'
                      : 'bg-slate-500/15 text-slate-300 border-slate-500/30',
                  )}
                >
                  {u.isActive ? 'Active' : 'Inactive'}
                </span>
              ),
            },
            {
              key: 'last',
              label: 'Last login',
              render: (u) =>
                u.lastLoginAt ? (
                  <span className="text-xs text-slate-400">
                    {formatDate(u.lastLoginAt)}
                  </span>
                ) : (
                  <span className="text-xs text-slate-500">—</span>
                ),
            },
            {
              key: 'actions',
              label: '',
              align: 'right',
              render: (u) => (
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => setModal({ open: true, user: u })}
                    className="h-8 w-8 rounded-lg bg-panel-900 hover:bg-brand-500 hover:text-white flex items-center justify-center text-slate-300 tap-btn"
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setPwdModal({ open: true, user: u })}
                    className="h-8 w-8 rounded-lg bg-panel-900 hover:bg-flame-500 hover:text-white flex items-center justify-center text-slate-300 tap-btn"
                    title="Reset password"
                  >
                    <KeyRound size={14} />
                  </button>
                  {u.isActive ? (
                    <button
                      disabled={me?._id === u._id}
                      onClick={() => {
                        if (window.confirm(`Deactivate ${u.name}?`)) {
                          deactivate.mutate(u._id);
                        }
                      }}
                      className="h-8 w-8 rounded-lg bg-panel-900 hover:bg-ember-500 hover:text-white flex items-center justify-center text-slate-300 tap-btn disabled:opacity-40 disabled:cursor-not-allowed"
                      title={me?._id === u._id ? "Can't deactivate yourself" : 'Deactivate'}
                    >
                      <UserX size={14} />
                    </button>
                  ) : (
                    <button
                      onClick={() => reactivate.mutate(u._id)}
                      className="h-8 w-8 rounded-lg bg-panel-900 hover:bg-leaf-500 hover:text-white flex items-center justify-center text-slate-300 tap-btn"
                      title="Reactivate"
                    >
                      <UserCheck size={14} />
                    </button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>

      <UserModal
        state={modal}
        onClose={() => setModal({ open: false, user: null })}
        onSave={(p) => save.mutate(p)}
        saving={save.isPending}
      />
      <PasswordModal
        state={pwdModal}
        onClose={() => setPwdModal({ open: false, user: null })}
        onSave={(p) => changePassword.mutate(p)}
        saving={changePassword.isPending}
      />
    </>
  );
}

function stripId(p) {
  const { _id, ...rest } = p;
  return rest;
}

function UserModal({ state, onClose, onSave, saving }) {
  const editing = !!state.user;
  const [form, setForm] = useState(defaultUser(state.user));
  useEffect(() => setForm(defaultUser(state.user)), [state.open, state.user]);

  const submit = (e) => {
    e?.preventDefault?.();
    if (editing) {
      onSave({
        _id: state.user._id,
        name: form.name.trim(),
        role: form.role,
        isActive: form.isActive,
      });
    } else {
      if (!form.name.trim() || !form.username.trim() || !form.password) return;
      onSave({
        name: form.name.trim(),
        username: form.username.trim().toLowerCase(),
        role: form.role,
        password: form.password,
      });
    }
  };

  return (
    <Modal
      open={state.open}
      onClose={onClose}
      title={editing ? `Edit ${state.user.name}` : 'New user'}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="blue" onClick={submit} loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <Field label="Full name">
          <TextInput
            autoFocus
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        {!editing && (
          <>
            <Field label="Username" hint="Lowercase, alphanumeric, 3-30 chars">
              <TextInput
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </Field>
            <Field label="Password" hint="Min 6 characters">
              <TextInput
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </Field>
          </>
        )}
        <Field label="Role">
          <Select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            {Object.values(USER_ROLE).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Select>
        </Field>
        {editing && (
          <Field label="Active">
            <Toggle
              checked={form.isActive}
              onChange={(v) => setForm({ ...form, isActive: v })}
              label={form.isActive ? 'Can log in' : 'Login disabled'}
            />
          </Field>
        )}
      </form>
    </Modal>
  );
}

function defaultUser(u) {
  return {
    name: u?.name || '',
    username: u?.username || '',
    password: '',
    role: u?.role || USER_ROLE.CASHIER,
    isActive: u ? u.isActive !== false : true,
  };
}

function PasswordModal({ state, onClose, onSave, saving }) {
  const [pwd, setPwd] = useState('');
  useEffect(() => setPwd(''), [state.open]);

  const submit = (e) => {
    e?.preventDefault?.();
    if (!state.user || pwd.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    onSave({ id: state.user._id, password: pwd });
  };

  return (
    <Modal
      open={state.open}
      onClose={onClose}
      title={state.user ? `Reset password — ${state.user.name}` : 'Reset password'}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="blue" onClick={submit} loading={saving}>
            Update
          </Button>
        </>
      }
    >
      <form onSubmit={submit}>
        <Field label="New password" hint="Min 6 characters">
          <TextInput
            autoFocus
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
          />
        </Field>
      </form>
    </Modal>
  );
}
