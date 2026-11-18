const mongoose = require('mongoose');
const config = require('./index');
const logger = require('../utils/logger');

function isReady() { return mongoose.connection.readyState === 1; }

async function connect() {
  if (!config.mongoUri) {
    logger.error('MONGODB_URI is missing. The server will start, but payments remain unavailable.');
    return false;
  }
  try {
    await mongoose.connect(config.mongoUri, config.mongo);
    logger.info('Connected to MongoDB.');
    return true;
  } catch (error) {
    logger.error('MongoDB connection failed:', error.message);
    return false;
  }
}

mongoose.connection.on('error', error => logger.error('MongoDB error:', error.message));
mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected.'));

module.exports = { connect, isReady, disconnect: () => mongoose.disconnect() };