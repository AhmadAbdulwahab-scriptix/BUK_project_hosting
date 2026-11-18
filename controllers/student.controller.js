const Student = require('../models/Student');
const asyncHandler = require('../utils/asyncHandler');

const listStudents = asyncHandler(async (_req, res) => {
  const students = await Student.find()
    .select('name registrationNumber paid paidAt createdAt updatedAt')
    .sort({ registrationNumber: 1 })
    .lean();
  res.json({ count: students.length, students });
});

const getPaidStatus = asyncHandler(async (req, res) => {
  const student = await Student.findOne({ registrationNumber: req.params.regNumber })
    .select('name registrationNumber paid paidAt paymentReference createdAt updatedAt')
    .lean();
  if (!student) {
    res.status(404).json({ message: 'Student not found.' });
    return;
  }
  res.json({ student });
});

module.exports = { listStudents, getPaidStatus };