import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  Layers,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import clsx from 'clsx';

import PageHeader from '../../components/admin/PageHeader';
import { Field, TextInput, NumberInput, Select, Toggle } from '../../components/admin/FormField';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import Loader from '../../components/Loader';
import EmptyState from '../../components/EmptyState';

import { menuApi } from '../../api/menu';
import { money } from '../../utils/format';

const TYPES = ['veg', 'non-veg', 'egg'];

/**
 *  Menu management
 *  ---------------
 *  Left:  category list (add / edit / delete).
 *  Right: items inside the selected category — search bar, add item,
 *         inline toggle availability, edit, delete.
 *
 *  Add/edit uses a modal form. All mutations optimistically refetch the
 *  affected list.
 */
export default function MenuPage() {
  const qc = useQueryClient();
  const [activeCatId, setActiveCatId] = useState(null);
  const [search, setSearch] = useState('');

  const [catModal, setCatModal] = useState({ open: false, category: null });
  const [itemModal, setItemModal] = useState({ open: false, item: null });

  const { data: categories = [], isLoading: loadingCats } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: menuApi.categories,
  });

  useEffect(() => {
    if (!activeCatId && categories.length) setActiveCatId(categories[0]._id);
  }, [categories, activeCatId]);

  const { data: items = [], isLoading: loadingItems } = useQuery({
    queryKey: ['admin-menu-items', activeCatId, search],
    queryFn: () =>
      menuApi.items({
        ...(activeCatId ? { category: activeCatId } : {}),
        ...(search ? { search } : {}),
      }),
    enabled: !!activeCatId,
    keepPreviousData: true,
  });

  // ── mutations ─────────────────────────────────────────────────────
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['admin-categories'] });
    qc.invalidateQueries({ queryKey: ['admin-menu-items'] });
    qc.invalidateQueries({ queryKey: ['categories'] });
    qc.invalidateQueries({ queryKey: ['menu-items'] });
  };

  const saveCategory = useMutation({
    mutationFn: (payload) =>
      payload._id
        ? menuApi.updateCategory(payload._id, stripId(payload))
        : menuApi.createCategory(stripId(payload)),
    onSuccess: (c) => {
      invalidateAll();
      if (!activeCatId && c?._id) setActiveCatId(c._id);
      toast.success('Category saved');
      setCatModal({ open: false, category: null });
    },
    onError: (e) => toast.error(e.message || 'Save failed'),
  });

  const deleteCategory = useMutation({
    mutationFn: (id) => menuApi.deleteCategory(id),
    onSuccess: () => {
      invalidateAll();
      setActiveCatId(null);
      toast.success('Category deleted');
    },
    onError: (e) => toast.error(e.message || 'Delete failed'),
  });

  const saveItem = useMutation({
    mutationFn: (payload) =>
      payload._id
        ? menuApi.updateItem(payload._id, stripId(payload))
        : menuApi.createItem(stripId(payload)),
    onSuccess: () => {
      invalidateAll();
      toast.success('Item saved');
      setItemModal({ open: false, item: null });
    },
    onError: (e) => toast.error(e.message || 'Save failed'),
  });

  const toggleAvailability = useMutation({
    mutationFn: (id) => menuApi.toggleAvailability(id),
    onSuccess: () => invalidateAll(),
    onError: (e) => toast.error(e.message || 'Toggle failed'),
  });

  const deleteItem = useMutation({
    mutationFn: (id) => menuApi.deleteItem(id),
    onSuccess: () => {
      invalidateAll();
      toast.success('Item removed');
    },
    onError: (e) => toast.error(e.message || 'Delete failed'),
  });

  const activeCategory = useMemo(
    () => categories.find((c) => c._id === activeCatId) || null,
    [categories, activeCatId],
  );

  return (
    <>
      <PageHeader
        title="Menu"
        subtitle={`${categories.length} categories · ${items.length} items in view`}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              icon={Layers}
              onClick={() => setCatModal({ open: true, category: null })}
            >
              New category
            </Button>
            <Button
              variant="blue"
              size="sm"
              icon={Plus}
              disabled={!activeCategory}
              onClick={() => setItemModal({ open: true, item: null })}
            >
              New item
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[16rem_1fr] gap-5">
        {/* Categories */}
        <aside className="pos-panel p-3">
          {loadingCats ? (
            <Loader label="Loading…" />
          ) : categories.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="No categories yet"
              description="Create one to start adding menu items."
            />
          ) : (
            <ul className="space-y-1.5">
              {categories.map((c) => {
                const active = c._id === activeCatId;
                return (
                  <li key={c._id}>
                    <button
                      onClick={() => setActiveCatId(c._id)}
                      className={clsx(
                        'group w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm tap-btn transition',
                        active
                          ? 'bg-brand-500 text-white shadow-btn-blue'
                          : 'bg-panel-800 hover:bg-panel-700 text-slate-200',
                      )}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: c.color || '#6366F1' }}
                        />
                        <span className="truncate font-semibold">{c.name}</span>
                      </span>
                      <span className="text-xs opacity-70">
                        {c.kitchenStation || 'main'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {activeCategory && (
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                icon={Pencil}
                className="flex-1"
                onClick={() => setCatModal({ open: true, category: activeCategory })}
              >
                Edit
              </Button>
              <Button
                variant="red"
                size="sm"
                icon={Trash2}
                onClick={() => {
                  if (
                    window.confirm(
                      `Delete category "${activeCategory.name}"? Items keep their reference but the category will be hidden.`,
                    )
                  ) {
                    deleteCategory.mutate(activeCategory._id);
                  }
                }}
              />
            </div>
          )}
        </aside>

        {/* Items */}
        <section className="pos-panel p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search within this category…"
                className="input-dark pl-9 h-10 text-sm"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {loadingItems ? (
            <Loader label="Loading…" />
          ) : items.length === 0 ? (
            <EmptyState
              icon={UtensilsCrossed}
              title={search ? 'No matches' : 'No items in this category'}
              description={search ? 'Try a different keyword.' : 'Tap “New item” to add your first dish.'}
            />
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {items.map((it) => (
                <li
                  key={it._id}
                  className="group bg-panel-800 border border-white/5 rounded-xl p-3 hover:bg-panel-700/70 transition"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={clsx(
                        'h-3 w-3 mt-2 rounded-full shrink-0',
                        it.type === 'veg'
                          ? 'bg-leaf-500'
                          : it.type === 'egg'
                          ? 'bg-amber-400'
                          : 'bg-ember-500',
                      )}
                      title={it.type}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="text-white font-semibold truncate">
                          {it.name}
                        </div>
                        <div className="text-white font-bold tabular-nums">
                          {money(it.price)}
                        </div>
                      </div>
                      {it.description && (
                        <div className="text-xs text-slate-400 truncate mt-0.5">
                          {it.description}
                        </div>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        <button
                          onClick={() => toggleAvailability.mutate(it._id)}
                          className={clsx(
                            'inline-flex items-center gap-1 text-xs font-semibold tap-btn',
                            it.isAvailable
                              ? 'text-leaf-500 hover:text-leaf-600'
                              : 'text-slate-400 hover:text-white',
                          )}
                        >
                          {it.isAvailable ? (
                            <ToggleRight size={18} />
                          ) : (
                            <ToggleLeft size={18} />
                          )}
                          {it.isAvailable ? 'Available' : 'Unavailable'}
                        </button>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() =>
                              setItemModal({ open: true, item: it })
                            }
                            className="h-8 w-8 rounded-lg bg-panel-900 hover:bg-brand-500 hover:text-white flex items-center justify-center text-slate-300 tap-btn"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Remove "${it.name}"?`)) {
                                deleteItem.mutate(it._id);
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
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <CategoryModal
        state={catModal}
        onClose={() => setCatModal({ open: false, category: null })}
        onSave={(payload) => saveCategory.mutate(payload)}
        saving={saveCategory.isPending}
      />
      <ItemModal
        state={itemModal}
        categories={categories}
        defaultCategory={activeCategory}
        onClose={() => setItemModal({ open: false, item: null })}
        onSave={(payload) => saveItem.mutate(payload)}
        saving={saveItem.isPending}
      />
    </>
  );
}

function stripId(payload) {
  const { _id, ...rest } = payload;
  return rest;
}

// ── Category modal ──────────────────────────────────────────────────
function CategoryModal({ state, onClose, onSave, saving }) {
  const editing = !!state.category;
  const [form, setForm] = useState(defaultCategory(state.category));
  useEffect(() => setForm(defaultCategory(state.category)), [state.open, state.category]);

  const submit = (e) => {
    e?.preventDefault?.();
    if (!form.name.trim()) return;
    onSave({
      _id: state.category?._id,
      name: form.name.trim(),
      kitchenStation: form.kitchenStation.trim() || 'main',
      displayOrder: Number(form.displayOrder) || 0,
      color: form.color,
    });
  };

  return (
    <Modal
      open={state.open}
      onClose={onClose}
      title={editing ? 'Edit category' : 'New category'}
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
        <Field label="Name">
          <TextInput
            autoFocus
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Veg Starters"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kitchen station" hint="e.g. main, tandoor, biryani">
            <TextInput
              value={form.kitchenStation}
              onChange={(e) => setForm({ ...form, kitchenStation: e.target.value })}
            />
          </Field>
          <Field label="Display order">
            <NumberInput
              value={form.displayOrder}
              onChange={(e) => setForm({ ...form, displayOrder: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Color (hex)">
          <div className="flex items-center gap-2">
            <TextInput
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
              placeholder="#F59E0B"
            />
            <span
              className="h-10 w-10 rounded-lg border border-white/10"
              style={{ background: form.color || '#334155' }}
            />
          </div>
        </Field>
      </form>
    </Modal>
  );
}

function defaultCategory(c) {
  return {
    name: c?.name || '',
    kitchenStation: c?.kitchenStation || 'main',
    displayOrder: c?.displayOrder ?? 0,
    color: c?.color || '#6366F1',
  };
}

// ── Item modal ──────────────────────────────────────────────────────
function ItemModal({ state, categories, defaultCategory: dc, onClose, onSave, saving }) {
  const editing = !!state.item;
  const [form, setForm] = useState(defaultItem(state.item, dc));
  useEffect(
    () => setForm(defaultItem(state.item, dc)),
    [state.open, state.item, dc],
  );

  const submit = (e) => {
    e?.preventDefault?.();
    if (!form.name.trim() || !form.category) return;
    onSave({
      _id: state.item?._id,
      name: form.name.trim(),
      description: form.description,
      price: Number(form.price) || 0,
      type: form.type,
      category: form.category,
      kitchenStation: form.kitchenStation || null,
      prepTimeMinutes: Number(form.prepTimeMinutes) || 0,
      isAvailable: !!form.isAvailable,
    });
  };

  return (
    <Modal
      open={state.open}
      onClose={onClose}
      title={editing ? 'Edit item' : 'New item'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="blue" onClick={submit} loading={saving}>
            Save item
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Name" className="md:col-span-2">
          <TextInput
            autoFocus
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Chicken Biryani (Half)"
          />
        </Field>
        <Field label="Price">
          <NumberInput
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            min="0"
          />
        </Field>
        <Field label="Type">
          <Select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Category">
          <Select
            value={form.category || ''}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            <option value="" disabled>
              Select…
            </option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Kitchen station override" hint="Leave empty to inherit from category">
          <TextInput
            value={form.kitchenStation}
            onChange={(e) => setForm({ ...form, kitchenStation: e.target.value })}
            placeholder="main / tandoor / biryani"
          />
        </Field>
        <Field label="Prep time (min)">
          <NumberInput
            value={form.prepTimeMinutes}
            onChange={(e) => setForm({ ...form, prepTimeMinutes: e.target.value })}
            min="0"
          />
        </Field>
        <Field label="Available">
          <Toggle
            checked={form.isAvailable}
            onChange={(v) => setForm({ ...form, isAvailable: v })}
            label={form.isAvailable ? 'Shown on POS' : 'Hidden from POS'}
          />
        </Field>
        <Field label="Description" className="md:col-span-2">
          <TextInput
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Optional — shows as a subtitle on the POS"
          />
        </Field>
      </form>
    </Modal>
  );
}

function defaultItem(i, fallbackCat) {
  return {
    name: i?.name || '',
    description: i?.description || '',
    price: i?.price ?? 0,
    type: i?.type || 'veg',
    category: i?.category?._id || i?.category || fallbackCat?._id || '',
    kitchenStation: i?.kitchenStation || '',
    prepTimeMinutes: i?.prepTimeMinutes ?? 10,
    isAvailable: i ? !!i.isAvailable : true,
  };
}
