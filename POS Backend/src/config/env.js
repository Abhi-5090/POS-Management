'use strict';

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const required = (key, fallback) => {
  const val = process.env[key];
  if (val === undefined || val === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val;
};

const toInt = (val, fallback) => {
  const n = parseInt(val, 10);
  return Number.isFinite(n) ? n : fallback;
};

const toFloat = (val, fallback) => {
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : fallback;
};

const config = {
  env: process.env.NODE_ENV || 'development',
  port: toInt(process.env.PORT, 4000),
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  corsOrigin: process.env.CORS_ORIGIN || '*',

  mongo: {
    uri: required('MONGODB_URI', 'mongodb://127.0.0.1:27017/pos_management'),
  },

  auth: {
    jwtSecret: required('JWT_SECRET', 'dev-secret-change-me'),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
    bcryptSaltRounds: toInt(process.env.BCRYPT_SALT_ROUNDS, 10),
  },

  billing: {
    defaultTaxRate: toFloat(process.env.DEFAULT_TAX_RATE, 5),
    currency: process.env.CURRENCY || 'INR',
    currencySymbol: process.env.CURRENCY_SYMBOL || 'Rs.',
  },

  restaurant: {
    name: process.env.RESTAURANT_NAME || 'My Restaurant',
    address: process.env.RESTAURANT_ADDRESS || '',
    phone: process.env.RESTAURANT_PHONE || '',
    gstin: process.env.RESTAURANT_GSTIN || '',
  },

  printer: {
    mode: (process.env.PRINTER_MODE || 'file').toLowerCase(),
    fileDir: process.env.PRINTER_FILE_DIR || './print-queue',
    width: toInt(process.env.PRINTER_WIDTH, 48),
    kitchen: {
      host: process.env.KITCHEN_PRINTER_HOST || '',
      port: toInt(process.env.KITCHEN_PRINTER_PORT, 9100),
      vendorId: process.env.KITCHEN_PRINTER_VENDOR_ID || '',
      productId: process.env.KITCHEN_PRINTER_PRODUCT_ID || '',
    },
    counter: {
      host: process.env.COUNTER_PRINTER_HOST || '',
      port: toInt(process.env.COUNTER_PRINTER_PORT, 9100),
      vendorId: process.env.COUNTER_PRINTER_VENDOR_ID || '',
      productId: process.env.COUNTER_PRINTER_PRODUCT_ID || '',
    },
  },
};

module.exports = config;
