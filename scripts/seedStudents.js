/**
 * Script to seed the Student collection with registered students.
 * Run with: node scripts/seedStudents.js
 */
const mongoose = require('mongoose');
require('dotenv').config();

const Student = require('../models/Student');

// Student data - matches the order in public/app.js
// Run this after ensuring MongoDB connection works:
//   node scripts/seedStudents.js
const students = [
  { name: "Abdulhalim Abdullahi Tukur", registrationNumber: "CST/22/SWE/00801" },
  { name: "Imrana Zakari Abdullahi", registrationNumber: "CST/22/SWE/00802" },
  { name: "Abdullahi Abdurrazaq Nakore", registrationNumber: "CST/22/SWE/00803" },
  { name: "Ahmed Abdulwahab", registrationNumber: "CST/22/SWE/00807" },
  { name: "Muhammad Auwal Anuhi", registrationNumber: "CST/22/SWE/00812" },
  { name: "Abdulhafiz Bello Salisu", registrationNumber: "CST/22/SWE/00814" },
  { name: "Hassan Hassan", registrationNumber: "CST/22/SWE/00821" },
  { name: "Abdulhafeez Ibrahim Ahmad", registrationNumber: "CST/22/SWE/00822" },
  { name: "Muhsin Ibrahim Ahmad", registrationNumber: "CST/22/SWE/00827" },
  { name: "Ahmad Tijjani Imam", registrationNumber: "CST/22/SWE/00830" },
  { name: "Jahv Idiongo", registrationNumber: "CST/22/SWE/00831" },
  { name: "Muhammad Muhammad Lamido", registrationNumber: "CST/22/SWE/00832" },
  { name: "Lawal Abdurrahim Idah", registrationNumber: "CST/22/SWE/00833" },
  { name: "Mohammed Imran Baba", registrationNumber: "CST/22/SWE/00835" },
  { name: "Umar Mohammed Bibi", registrationNumber: "CST/22/SWE/00836" },
  { name: "Abdulrahman Muhammad", registrationNumber: "CST/22/SWE/00837" },
  { name: "Abdulrahman Muhammad", registrationNumber: "CST/22/SWE/00838" },
  { name: "Usman Aminu Muhammad", registrationNumber: "CST/22/SWE/00839" },
  { name: "Maryam Musa", registrationNumber: "CST/22/SWE/00840" },
  { name: "Tat Gerald Stephen", registrationNumber: "CST/22/SWE/00845" },
  { name: "Ahmad Farouk Umar", registrationNumber: "CST/22/SWE/00848" },
  { name: "Abbas Yakubu", registrationNumber: "CST/22/SWE/00850" },
  { name: "Rukayya Faruk", registrationNumber: "CST/22/SWE/00854" },
  { name: "Ahmad Rabiu", registrationNumber: "CST/22/SWE/00856" },
  { name: "Abdullaziz Aliyu Abdullahi", registrationNumber: "CST/22/SWE/00857" },
  { name: "Usman Lawan Yau", registrationNumber: "CST/22/SWE/00860" },
  { name: "Muhammad Muhammad Nataala", registrationNumber: "CST/22/SWE/00861" },
  { name: "Ummuaiman Sabo", registrationNumber: "CST/22/SWE/00862" },
  { name: "Abdullahi Abdullahi Haruna", registrationNumber: "CST/22/SWE/00819" },
  { name: "Auwalu Muhammad Izziddin", registrationNumber: "CST/22/SWE/00864" }
];

async function seed() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI is not set in .env');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri, {
      maxPoolSize: 5
    });
    console.log('Connected to MongoDB');

    // Clear existing students
    const deleted = await Student.deleteMany({});
    console.log(`Deleted ${deleted.deletedCount} existing students`);

    // Insert new students
    const result = await Student.insertMany(students);
    console.log(`Seeded ${result.length} students`);

    // Verify
    const count = await Student.countDocuments();
    console.log(`Total students in database: ${count}`);

    await mongoose.disconnect();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
}

seed();