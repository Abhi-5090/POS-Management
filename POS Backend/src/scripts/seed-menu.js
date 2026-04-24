'use strict';

/**
 * Load the real restaurant menu.
 *
 * Design choices
 * --------------
 * 1. For items that ship in two portions (Half / Full, 2 pcs / 4 pcs,
 *    Single / Double), we persist them as TWO separate MenuItems with
 *    the portion suffixed in the name — e.g. "Chicken Biryani (Half)"
 *    and "Chicken Biryani (Full)". This keeps the cart, KOT and bill
 *    unambiguous with zero schema changes.
 *
 * 2. Items with a single size stay as one row.
 *
 * 3. Before upserting the new catalogue we deactivate every existing
 *    Category / MenuItem (isActive=false). Rows that collide by name
 *    get re-activated and have price/category/type repaired. The
 *    result is a clean menu with no stale demo clutter, while
 *    preserving _ids so any existing orders still dereference.
 *
 * 4. Categories pick a realistic kitchen station so multi-station
 *    printing ("main" vs "biryani") routes correctly.
 *
 * Run: `npm run seed:menu`
 */

const mongoose = require('mongoose');
const { connectDatabase, disconnectDatabase } = require('../config/database');
const { Category, MenuItem } = require('../models');
const logger = require('../utils/logger');

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ── Categories ───────────────────────────────────────────────────────
const CATEGORIES = [
  { name: 'Veg Starters',          kitchenStation: 'main',    displayOrder: 1, color: '#84CC16' },
  { name: 'Veg Cutlets & Fry',     kitchenStation: 'main',    displayOrder: 2, color: '#22C55E' },
  { name: 'Veg Curries',           kitchenStation: 'main',    displayOrder: 3, color: '#10B981' },
  { name: 'Non-Veg Starters',      kitchenStation: 'main',    displayOrder: 4, color: '#EF4444' },
  { name: 'Non-Veg Curries',       kitchenStation: 'main',    displayOrder: 5, color: '#DC2626' },
  { name: 'Veg Rice & Biryani',    kitchenStation: 'biryani', displayOrder: 6, color: '#F59E0B' },
  { name: 'Non-Veg Rice & Pulao',  kitchenStation: 'biryani', displayOrder: 7, color: '#F97316' },
  { name: 'Non-Veg Biryanis',      kitchenStation: 'biryani', displayOrder: 8, color: '#B91C1C' },
];

/**
 * Menu catalogue.
 *
 * Helpers:
 *   single(name, price, type) — one size
 *   hf(name, half, full, type) — "(Half)" + "(Full)" pair
 *   sized(name, s1Label, s1Price, s2Label, s2Price, type) — arbitrary labels
 */
const single = (name, price, type = 'veg') => [{ name, price, type }];
const hf = (name, half, full, type = 'veg') => [
  { name: `${name} (Half)`, price: half, type },
  { name: `${name} (Full)`, price: full, type },
];
const sized = (name, l1, p1, l2, p2, type = 'veg') => [
  { name: `${name} (${l1})`, price: p1, type },
  { name: `${name} (${l2})`, price: p2, type },
];

const MENU = {
  'Veg Starters': [
    ...single('Veg Manchurian', 160, 'veg'),
    ...single('Paneer 65', 160, 'veg'),
    ...single('Chilli Mushroom', 180, 'veg'),
    ...single('Mushroom Fry', 170, 'veg'),
  ],

  'Veg Cutlets & Fry': [
    ...single('Paneer Cutlet', 140, 'veg'),
    ...single('Cabbage Paneer Cutlet', 140, 'veg'),
    ...single('Tomato Cutlet', 140, 'veg'),
  ],

  'Veg Curries': [
    ...hf('Mushroom Curry', 220, 350, 'veg'),
    ...hf('Brinjal Curry', 160, 240, 'veg'),
    ...hf('Fresh Curry', 200, 280, 'veg'),
    ...single('Cabbage Bit Curry', 110, 'veg'),
    ...sized('Kaju Curry', '2 pcs', 180, '4 pcs', 300, 'veg'),
  ],

  'Non-Veg Starters': [
    ...single('Chicken 65', 250, 'non-veg'),
    ...single('Chilli Chicken', 250, 'non-veg'),
    ...single('Chicken Manchurian', 250, 'non-veg'),
    ...single('Lemon Chicken', 300, 'non-veg'),
    ...single('Crispy Chicken', 270, 'non-veg'),
    ...single('Chicken 555', 300, 'non-veg'),
    ...single('Ginger Chicken', 250, 'non-veg'),
    ...sized('Kaju Chicken', '2 pcs', 170, '4 pcs', 300, 'non-veg'),
    ...sized('Chicken Roast', '2 pcs', 170, '4 pcs', 300, 'non-veg'),
    ...single('Cashew Nut Chicken', 300, 'non-veg'),
    ...single('Joint Roast', 150, 'non-veg'),
    ...single('Onion Chicken', 300, 'non-veg'),
    ...single('Lollipop', 250, 'non-veg'),
    ...single('Cabbage Fry', 100, 'veg'),
    ...single('Cabbage Fry Roast', 110, 'veg'),
    ...hf('Liver Fry', 120, 180, 'non-veg'),
  ],

  'Non-Veg Curries': [
    ...hf('Chicken Curry', 150, 240, 'non-veg'),
    ...hf('Chicken Boneless Curry', 170, 250, 'non-veg'),
    ...single('Joint Roast Curry', 150, 'non-veg'),
    ...hf('Liver Curry', 120, 180, 'non-veg'),
    ...single('Lollipop Curry', 250, 'non-veg'),
  ],

  'Veg Rice & Biryani': [
    ...single('Veg Meals', 100, 'veg'),
    ...single('Curd Rice', 80, 'veg'),
    ...hf('Veg Fried Rice', 170, 280, 'veg'),
    ...hf('Veg Pulao', 170, 280, 'veg'),
    ...single('Paneer Biryani', 340, 'veg'),
    ...single('Kaju Biryani', 340, 'veg'),
    ...single('Mushroom Biryani', 340, 'veg'),
  ],

  'Non-Veg Rice & Pulao': [
    ...hf('Egg Fried Rice', 170, 250, 'egg'),
    ...hf('Chicken Fried Rice', 200, 280, 'non-veg'),
    ...hf('Mutton Fried Rice', 250, 350, 'non-veg'),
    ...single('Mixed Fried Rice', 330, 'non-veg'),
    ...single('Mixed Fried Rice (Special)', 270, 'non-veg'),
    ...single('Mutton Mixed', 400, 'non-veg'),
    ...single('Fresh Fried Rice', 300, 'non-veg'),
    ...hf('Boneless Pulao', 290, 400, 'non-veg'),
    ...single('Joint Pulao', 280, 'non-veg'),
    ...single('Mixed Pulao', 330, 'non-veg'),
    ...single('Premium Pulao', 350, 'non-veg'),
    ...single('Cabbage Pulao', 270, 'veg'),
  ],

  'Non-Veg Biryanis': [
    ...hf('Mixed Biryani', 330, 430, 'non-veg'),
    ...hf('Chicken Biryani', 200, 300, 'non-veg'),
    ...hf('Egg Biryani', 170, 280, 'egg'),
    ...hf('Fry Piece Biryani', 280, 400, 'non-veg'),
    ...single('Mutton Biryani', 330, 'non-veg'),
    ...single('Boneless Biryani', 280, 'non-veg'),
    ...hf('Dum Biryani', 200, 300, 'non-veg'),
    ...hf('Liver Fry Biryani', 170, 220, 'non-veg'),
    ...single('Deluxe Biryani', 500, 'non-veg'),
  ],
};

/**
 *   We purposely don't delete — preserving _ids matters if any live
 *   orders reference old items. We deactivate, then upsert & re-activate
 *   what's in the new menu.
 */
async function deactivateExisting() {
  const [c, m] = await Promise.all([
    Category.updateMany({}, { $set: { isActive: false } }),
    MenuItem.updateMany({}, { $set: { isActive: false } }),
  ]);
  logger.info(
    `deactivated ${c.modifiedCount} existing categor${c.modifiedCount === 1 ? 'y' : 'ies'}, ${m.modifiedCount} menu items`,
  );
}

async function upsertCategory(doc) {
  const slug = doc.slug || slugify(doc.name);
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

async function upsertMenuItem({ name, price, type, category, kitchenStation }) {
  return MenuItem.findOneAndUpdate(
    { name },
    {
      $set: {
        price,
        type,
        category,
        kitchenStation: kitchenStation || null,
        isAvailable: true,
        isActive: true,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
}

async function main() {
  await connectDatabase();

  await Promise.all([Category.syncIndexes(), MenuItem.syncIndexes()]);
  logger.info('indexes synced');

  await deactivateExisting();

  // Categories ────────────────────────────────
  const catByName = {};
  for (const c of CATEGORIES) {
    const doc = await upsertCategory(c);
    catByName[c.name] = doc;
  }
  logger.info(`seeded ${CATEGORIES.length} categories`);

  // Items ─────────────────────────────────────
  let total = 0;
  const perCategory = {};
  for (const [catName, items] of Object.entries(MENU)) {
    const cat = catByName[catName];
    if (!cat) {
      logger.warn(`no category found for "${catName}", skipping`);
      continue;
    }
    for (const it of items) {
      await upsertMenuItem({
        name: it.name,
        price: it.price,
        type: it.type,
        category: cat._id,
        kitchenStation: cat.kitchenStation,
      });
      total += 1;
    }
    perCategory[catName] = items.length;
  }
  logger.info(`seeded ${total} menu items`);
  for (const [k, v] of Object.entries(perCategory)) {
    logger.info(`   · ${k}: ${v}`);
  }

  await disconnectDatabase();
  await mongoose.disconnect().catch(() => {});
  logger.info('menu seed complete');
}

main().catch((err) => {
  logger.error('menu seed failed', { err: err.stack || err.message });
  process.exit(1);
});
