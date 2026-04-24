'use strict';

/**
 * Seed the database with:
 *   - default admin user (admin / admin123)
 *   - a cashier, kitchen, and waiter user
 *   - a handful of categories, items, and tables
 *
 * Safe to run multiple times — upserts on stable keys, repairs any
 * legacy rows missing a `slug`, and calls syncIndexes() so index
 * changes in the schema (e.g. slug becoming sparse) are applied.
 */

const mongoose = require('mongoose');
const { connectDatabase, disconnectDatabase } = require('../config/database');
const {
  User,
  Table,
  Category,
  MenuItem,
  USER_ROLE,
} = require('../models');
const logger = require('../utils/logger');

function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function upsertUser({ name, username, password, role }) {
  let user = await User.findOne({ username });
  if (!user) {
    user = new User({ name, username, role });
    await user.setPassword(password);
    await user.save();
    logger.info(`seeded user: ${username} (${role})`);
  }
  return user;
}

async function upsertCategory(doc) {
  const slug = doc.slug || slugify(doc.name);
  // $set so we also repair legacy rows that were created without a slug.
  return Category.findOneAndUpdate(
    { name: doc.name },
    {
      $set: {
        slug,
        kitchenStation: doc.kitchenStation || 'main',
        displayOrder: doc.displayOrder ?? 0,
        color: doc.color || '#6366F1',
        icon: doc.icon || '',
        isActive: true,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
}

async function upsertMenuItem(doc) {
  return MenuItem.findOneAndUpdate(
    { name: doc.name },
    { $setOnInsert: doc },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
}

async function upsertTable(doc) {
  return Table.findOneAndUpdate(
    { number: doc.number },
    { $setOnInsert: doc },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
}

/**
 * Legacy cleanup: if a previous run inserted rows with slug=null (before
 * the sparse-unique fix), give them a real slug derived from name.
 */
async function repairLegacyCategorySlugs() {
  const broken = await Category.find({
    $or: [{ slug: null }, { slug: { $exists: false } }, { slug: '' }],
  });
  for (const c of broken) {
    c.slug = slugify(c.name);
    await c.save();
    logger.info(`repaired category slug: ${c.name} → ${c.slug}`);
  }
}

async function main() {
  await connectDatabase();

  // Rebuild indexes to match the current schema (drops stale ones, e.g.
  // the old non-sparse `slug_1` index on categories).
  await Promise.all([
    Category.syncIndexes(),
    MenuItem.syncIndexes(),
    Table.syncIndexes(),
    User.syncIndexes(),
  ]);
  logger.info('indexes synced');

  await repairLegacyCategorySlugs();

  await upsertUser({ name: 'Admin', username: 'admin', password: 'admin123', role: USER_ROLE.ADMIN });
  await upsertUser({ name: 'Cashier', username: 'cashier', password: 'cashier123', role: USER_ROLE.CASHIER });
  await upsertUser({ name: 'Kitchen', username: 'kitchen', password: 'kitchen123', role: USER_ROLE.KITCHEN });
  await upsertUser({ name: 'Waiter', username: 'waiter', password: 'waiter123', role: USER_ROLE.WAITER });

  const starters = await upsertCategory({ name: 'Starters', kitchenStation: 'main', displayOrder: 1, color: '#F59E0B' });
  const mains = await upsertCategory({ name: 'Main Course', kitchenStation: 'main', displayOrder: 2, color: '#EF4444' });
  const breads = await upsertCategory({ name: 'Breads', kitchenStation: 'tandoor', displayOrder: 3, color: '#84CC16' });
  const bev = await upsertCategory({ name: 'Beverages', kitchenStation: 'beverage', displayOrder: 4, color: '#06B6D4' });
  const desserts = await upsertCategory({ name: 'Desserts', kitchenStation: 'main', displayOrder: 5, color: '#EC4899' });
  logger.info('seeded 5 categories');

  const items = [
    { name: 'Paneer Tikka', price: 260, category: starters._id, type: 'veg' },
    { name: 'Chicken 65', price: 280, category: starters._id, type: 'non-veg' },
    { name: 'Veg Manchurian', price: 220, category: starters._id, type: 'veg' },
    { name: 'Butter Chicken', price: 360, category: mains._id, type: 'non-veg' },
    { name: 'Dal Tadka', price: 200, category: mains._id, type: 'veg' },
    { name: 'Paneer Butter Masala', price: 280, category: mains._id, type: 'veg' },
    { name: 'Chicken Biryani', price: 320, category: mains._id, type: 'non-veg' },
    { name: 'Veg Biryani', price: 260, category: mains._id, type: 'veg' },
    { name: 'Tandoori Roti', price: 30, category: breads._id, type: 'veg' },
    { name: 'Butter Naan', price: 50, category: breads._id, type: 'veg' },
    { name: 'Garlic Naan', price: 70, category: breads._id, type: 'veg' },
    { name: 'Fresh Lime Soda', price: 80, category: bev._id, type: 'veg' },
    { name: 'Masala Chai', price: 40, category: bev._id, type: 'veg' },
    { name: 'Mango Lassi', price: 120, category: bev._id, type: 'veg' },
    { name: 'Gulab Jamun', price: 90, category: desserts._id, type: 'veg' },
    { name: 'Kulfi', price: 110, category: desserts._id, type: 'veg' },
  ];
  for (const it of items) await upsertMenuItem(it);
  logger.info(`seeded ${items.length} menu items`);

  const tables = [];
  for (let i = 1; i <= 12; i += 1) {
    tables.push({
      number: `T${String(i).padStart(2, '0')}`,
      capacity: i % 4 === 0 ? 6 : 4,
      section: i <= 6 ? 'Indoor' : 'Outdoor',
    });
  }
  for (const t of tables) await upsertTable(t);
  logger.info(`seeded ${tables.length} tables`);

  await disconnectDatabase();
  await mongoose.disconnect().catch(() => {});
  logger.info('seed complete');
}

main().catch((err) => {
  logger.error('seed failed', { err: err.stack || err.message });
  process.exit(1);
});
