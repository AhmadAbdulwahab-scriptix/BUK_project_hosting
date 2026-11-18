const mongoose = require('mongoose');

const adminAuditSchema = new mongoose.Schema({
  action: { type: String, required: true },
  reference: { type: String, required: true, index: true },
  actor: { type: String, required: true },
  details: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

module.exports = mongoose.model('AdminAudit', adminAuditSchema);
