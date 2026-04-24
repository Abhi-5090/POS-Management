import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, LayoutGrid, Users, RefreshCcw } from 'lucide-react';
import clsx from 'clsx';

import PageHeader from '../../components/admin/PageHeader';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import EmptyState from '../../components/EmptyState';
import Loader from '../../components/Loader';
import { Field, TextInput, NumberInput, Select } from '../../components/admin/FormField';

import { tablesApi } from '../../api/tables';

const STATUS_COLOR = {
  free: 'bg-leaf-500/15 text-leaf-500 border-leaf-500/30',
  occupied: 'bg-ember-500/15 text-ember-500 border-ember-500/30',
  reserved: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
};

export default function AdminTablesPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState({ open: false, table: null });

  const { data: tables = [], isLoading, refetch } = useQuery({
    queryKey: ['admin-tables'],
    queryFn: tablesApi.list,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-tables'] });
    qc.invalidateQueries({ queryKey: ['tables'] });
  };

  const save = useMutation({
    mutationFn: (payload) =>
      payload._id
        ? tablesApi.update(payload._id, stripId(payload))
        : tablesApi.create(stripId(payload)),
    onSuccess: () => {
      invalidate();
      toast.success('Table saved');
      setModal({ open: false, table: null });
    },
    onError: (e) => toast.error(e.message || 'Save failed'),
  });

  const remove = useMutation({
    mutationFn: (id) => tablesApi.remove(id),
    onSuccess: () => {
      invalidate();
      toast.success('Table removed');
    },
    onError: (e) => toast.error(e.message || 'Delete failed'),
  });

  // Group by section
  const bySection = {};
  for (const t of tables) {
    (bySection[t.section || 'Main'] ||= []).push(t);
  }

  return (
    <>
      <PageHeader
        title="Tables"
        subtitle={`${tables.length} tables · ${Object.keys(bySection).length} section${Object.keys(bySection).length === 1 ? '' : 's'}`}
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              icon={RefreshCcw}
              onClick={() => refetch()}
            >
              Refresh
            </Button>
            <Button
              variant="blue"
              size="sm"
              icon={Plus}
              onClick={() => setModal({ open: true, table: null })}
            >
              New table
            </Button>
          </>
        }
      />

      {isLoading ? (
        <Loader label="Loading tables…" />
      ) : tables.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="No tables yet"
          description="Add a table to start accepting dine-in orders."
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(bySection).map(([section, arr]) => (
            <section key={section} className="pos-panel p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold">{section}</h3>
                <span className="text-xs text-slate-400">{arr.length} tables</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
                {arr.map((t) => (
                  <div
                    key={t._id}
                    className="relative rounded-xl bg-panel-800 border border-white/5 p-4 hover:bg-panel-700/80 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <div className="text-white font-extrabold text-lg truncate">
                          Table {t.number}
                        </div>
                        {t.displayName && (
                          <div className="text-slate-400 text-xs truncate mt-0.5">
                            {t.displayName}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs font-semibold text-slate-300 bg-panel-900 px-2 py-0.5 rounded-md">
                        <Users size={12} /> {t.capacity}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span
                        className={clsx(
                          'pos-chip border',
                          STATUS_COLOR[t.status] || STATUS_COLOR.free,
                        )}
                      >
                        {t.status}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setModal({ open: true, table: t })}
                          className="h-8 w-8 rounded-lg bg-panel-900 hover:bg-brand-500 hover:text-white flex items-center justify-center text-slate-300 tap-btn"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => {
                            if (t.status === 'occupied') {
                              toast.error('Table is occupied — close the session first.');
                              return;
                            }
                            if (window.confirm(`Remove table ${t.number}?`)) {
                              remove.mutate(t._id);
                            }
                          }}
                          className="h-8 w-8 rounded-lg bg-panel-900 hover:bg-ember-500 hover:text-white flex items-center justify-center text-slate-300 tap-btn"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <TableModal
        state={modal}
        onClose={() => setModal({ open: false, table: null })}
        onSave={(p) => save.mutate(p)}
        saving={save.isPending}
      />
    </>
  );
}

function stripId(p) {
  const { _id, ...rest } = p;
  return rest;
}

function TableModal({ state, onClose, onSave, saving }) {
  const editing = !!state.table;
  const [form, setForm] = useState(defaultTable(state.table));
  useEffect(() => setForm(defaultTable(state.table)), [state.open, state.table]);

  const submit = (e) => {
    e?.preventDefault?.();
    if (!form.number.trim()) return;
    const payload = {
      _id: state.table?._id,
      number: form.number.trim(),
      displayName: form.displayName.trim(),
      capacity: Number(form.capacity) || 4,
      section: form.section.trim() || 'Main',
    };
    // Admin can flip status/isActive on existing tables.
    if (editing) {
      payload.status = form.status;
      payload.isActive = form.isActive;
    }
    onSave(payload);
  };

  return (
    <Modal
      open={state.open}
      onClose={onClose}
      title={editing ? `Edit Table ${state.table.number}` : 'New table'}
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
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <Field label="Number" className="col-span-1">
          <TextInput
            autoFocus
            value={form.number}
            onChange={(e) => setForm({ ...form, number: e.target.value })}
            placeholder="T01"
          />
        </Field>
        <Field label="Capacity" className="col-span-1">
          <NumberInput
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: e.target.value })}
            min="1"
          />
        </Field>
        <Field label="Section" className="col-span-1">
          <TextInput
            value={form.section}
            onChange={(e) => setForm({ ...form, section: e.target.value })}
            placeholder="Indoor / Outdoor"
          />
        </Field>
        <Field label="Display name" className="col-span-1">
          <TextInput
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            placeholder="Optional"
          />
        </Field>
        {editing && (
          <>
            <Field label="Status" className="col-span-1">
              <Select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="free">free</option>
                <option value="occupied">occupied</option>
                <option value="reserved">reserved</option>
              </Select>
            </Field>
            <Field label="Active" className="col-span-1">
              <Select
                value={String(form.isActive)}
                onChange={(e) =>
                  setForm({ ...form, isActive: e.target.value === 'true' })
                }
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </Select>
            </Field>
          </>
        )}
      </form>
    </Modal>
  );
}

function defaultTable(t) {
  return {
    number: t?.number || '',
    displayName: t?.displayName || '',
    capacity: t?.capacity ?? 4,
    section: t?.section || 'Main',
    status: t?.status || 'free',
    isActive: t ? t.isActive !== false : true,
  };
}
