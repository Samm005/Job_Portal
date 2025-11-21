// models/Application.js (Updated)
const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  resume: { type: String, required: true },
  status: {
    type: String,
    enum: ['Applied', 'Under Review', 'Shortlisted', 'Rejected', 'Accepted'],
    default: 'Applied'
  },
  statusUpdatedAt: { type: Date, default: Date.now },
  statusUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  appliedDate: { type: Date, default: Date.now }
});

// Prevent duplicate applications
applicationSchema.index({ job: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('Application', applicationSchema);
