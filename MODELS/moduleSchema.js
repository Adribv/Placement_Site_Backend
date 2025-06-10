const mongoose = require('mongoose');

const trainingModule = new mongoose.Schema({
    title: String,
    description: String,
    durationDays: Number,
    examsCount: Number,
    location: { type: String, required: true },
    staffAssigned: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Staff' }],
    isCompleted: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  });

module.exports = mongoose.model('Module',trainingModule);