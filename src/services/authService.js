const bcrypt = require('bcryptjs');
const { User } = require('../config/database');

async function authenticate(username, password) {
  const user = await User.findOne({ username }).lean();
  if (!user) return null;
  if (!bcrypt.compareSync(password, user.password_hash)) return null;

  return { id: String(user._id), username: user.username, name: user.name };
}

async function getCurrentUser(userId) {
  let user;
  try {
    user = await User.findById(userId).lean();
  } catch (e) {
    user = null;
  }
  if (!user) return null;
  return { id: String(user._id), username: user.username, name: user.name };
}

module.exports = { authenticate, getCurrentUser };
