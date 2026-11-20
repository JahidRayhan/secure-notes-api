const mongoose = require('mongoose');
const AppError = require('./AppError');
const asyncHandler = require('./asyncHandler');
const { objectId } = require('../validators/common');

const parseObjectId = (value) => {
  if (!objectId.safeParse(value).success) throw new AppError(400, 'INVALID_ID', 'Invalid id');
  // aggregate() does not cast, so return a real ObjectId
  return new mongoose.Types.ObjectId(value);
};

const requireString = (value, field, max) => {
  if (typeof value !== 'string' || !value.trim()) throw new AppError(400, 'VALIDATION_ERROR', `${field} is required`);
  if (value.length > max) throw new AppError(400, 'VALIDATION_ERROR', `${field} must be at most ${max} characters`);
  return value.trim();
};

module.exports = { asyncHandler, parseObjectId, requireString };
