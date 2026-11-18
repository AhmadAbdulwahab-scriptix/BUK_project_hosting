const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  registrationNumber: { type: String, required: true, unique: true, trim: true },
  paid: { type: Boolean, default: false },
  paidAt: Date,
  paymentReference: String
}, { timestamps: true });

studentSchema.index({ paid: 1, name: 1 });

module.exports = mongoose.model('Student', studentSchema);