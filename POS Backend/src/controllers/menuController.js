'use strict';

const AppError = require('../utils/AppError');
const { Category, MenuItem } = require('../models');

// ── Categories ─────────────────────────────────────────

async function listCategories(_req, res) {
  const categories = await Category.find({ isActive: true }).sort({ displayOrder: 1, name: 1 });
  res.json({ success: true, data: categories });
}

async function createCategory(req, res) {
  const c = await Category.create(req.body);
  res.status(201).json({ success: true, data: c });
}

async function updateCategory(req, res) {
  const c = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!c) throw AppError.notFound('Category not found');
  res.json({ success: true, data: c });
}

async function deleteCategory(req, res) {
  const c = await Category.findById(req.params.id);
  if (!c) throw AppError.notFound('Category not found');
  c.isActive = false;
  await c.save();
  res.json({ success: true });
}

// ── Menu Items ─────────────────────────────────────────

async function listMenuItems(req, res) {
  const q = { isActive: true };
  if (req.query.category) q.category = req.query.category;
  if (req.query.available !== undefined) q.isAvailable = req.query.available === 'true';

  // Substring search across name + description + tags.
  // $text uses whole-word matching which feels broken on a POS
  // (typing "chic" wouldn't match "Chicken Biryani"). Regex is fine
  // at this scale (hundreds of items) and matches as the user types.
  // A multi-word query requires ALL tokens to match — so "chicken bir"
  // still finds "Chicken Biryani (Half)".
  if (req.query.search) {
    const term = String(req.query.search).trim();
    if (term) {
      const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const tokens = term.split(/\s+/).filter(Boolean);
      const tokenClause = (t) => {
        const rx = new RegExp(escape(t), 'i');
        return { $or: [{ name: rx }, { description: rx }, { tags: rx }] };
      };
      q.$and = tokens.map(tokenClause);
    }
  }

  const items = await MenuItem.find(q).populate('category', 'name slug').sort({ name: 1 });
  res.json({ success: true, data: items });
}

async function createMenuItem(req, res) {
  const item = await MenuItem.create(req.body);
  res.status(201).json({ success: true, data: item });
}

async function updateMenuItem(req, res) {
  const item = await MenuItem.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!item) throw AppError.notFound('Menu item not found');
  res.json({ success: true, data: item });
}

async function toggleMenuItemAvailability(req, res) {
  const item = await MenuItem.findById(req.params.id);
  if (!item) throw AppError.notFound('Menu item not found');
  item.isAvailable = !item.isAvailable;
  await item.save();
  res.json({ success: true, data: item });
}

async function deleteMenuItem(req, res) {
  const item = await MenuItem.findById(req.params.id);
  if (!item) throw AppError.notFound('Menu item not found');
  item.isActive = false;
  await item.save();
  res.json({ success: true });
}

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listMenuItems,
  createMenuItem,
  updateMenuItem,
  toggleMenuItemAvailability,
  deleteMenuItem,
};
