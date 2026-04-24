'use strict';

const AppError = require('../utils/AppError');
const { User, USER_ROLE } = require('../models');
const { signToken } = require('../middleware/auth');

async function login(req, res) {
  const { username, password } = req.body;
  const user = await User.findOne({ username: username.toLowerCase() }).select('+passwordHash');
  if (!user || !user.isActive) throw AppError.unauthorized('Invalid credentials');

  const ok = await user.verifyPassword(password);
  if (!ok) throw AppError.unauthorized('Invalid credentials');

  user.lastLoginAt = new Date();
  await user.save();

  const token = signToken(user);
  res.json({ success: true, data: { token, user: user.toJSON() } });
}

async function me(req, res) {
  res.json({ success: true, data: { user: req.user.toJSON() } });
}

async function createUser(req, res) {
  const { name, username, password, role } = req.body;
  if (!Object.values(USER_ROLE).includes(role)) {
    throw AppError.badRequest('Invalid role');
  }
  const exists = await User.findOne({ username: username.toLowerCase() });
  if (exists) throw AppError.conflict('Username already in use');

  const user = new User({ name, username: username.toLowerCase(), role });
  await user.setPassword(password);
  await user.save();
  res.status(201).json({ success: true, data: { user: user.toJSON() } });
}

async function listUsers(_req, res) {
  const users = await User.find().sort({ createdAt: -1 });
  res.json({ success: true, data: users });
}

async function deactivateUser(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) throw AppError.notFound('User not found');
  user.isActive = false;
  await user.save();
  res.json({ success: true, data: user.toJSON() });
}

async function updateUser(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) throw AppError.notFound('User not found');

  const { name, role, isActive, password } = req.body || {};
  if (name !== undefined) user.name = name;
  if (role !== undefined) {
    if (!Object.values(USER_ROLE).includes(role)) {
      throw AppError.badRequest('Invalid role');
    }
    user.role = role;
  }
  if (isActive !== undefined) user.isActive = !!isActive;
  if (password) await user.setPassword(password);

  await user.save();
  res.json({ success: true, data: user.toJSON() });
}

module.exports = { login, me, createUser, listUsers, updateUser, deactivateUser };
