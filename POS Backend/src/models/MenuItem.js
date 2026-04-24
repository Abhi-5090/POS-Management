'use strict';

const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true, sparse: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    price: { type: Number, required: true, min: 0 },
    taxRate: { type: Number, default: null, min: 0 },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    kitchenStation: { type: String, default: null, trim: true, lowercase: true, index: true },
    type: { type: String, enum: ['veg', 'non-veg', 'egg'], default: 'veg' },
    prepTimeMinutes: { type: Number, default: 10, min: 0 },
    isAvailable: { type: Boolean, default: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
    imageUrl: { type: String, default: '' },
    tags: [{ type: String, lowercase: true, trim: true }],
  },
  { timestamps: true },
);

menuItemSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('MenuItem', menuItemSchema);
