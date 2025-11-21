const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Job = require('../models/Job');
const Application = require('../models/Application');
const multer = require('multer');
const path = require('path');
const authMiddleware = require('../middleware/auth');
const { isEmployer } = require('../middleware/role');
const User = require('../models/User');

// ✅ Multer setup for resume upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/resumes/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// ✅ Apply for a job (Jobseeker)
router.post('/apply/:jobId', authMiddleware, upload.single('resume'), async (req, res) => {
  try {
    const { jobId } = req.params;
    const { userId } = req.user;

    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ message: 'Job not found' });

    const application = new Application({
      job: job._id,
      user: userId,
      resume: `uploads/resumes/${req.file.filename}`, // ✅ Save relative path
      status: 'Applied'
    });

    await application.save();
    res.status(201).json({ message: 'Application submitted successfully', application });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ View all applications by a jobseeker
router.get('/my-applications', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user;
    const applications = await Application.find({ user: userId })
      .populate('job')
      .populate('statusUpdatedBy', 'name')
      .select('-resume');
    res.status(200).json({ applications });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ View all applications for a job (Employer)
router.get('/job/:jobId/applications', authMiddleware, isEmployer, async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await Job.findById(jobId);
    
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    // Check if the employer owns this job
    if (job.postedBy.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to view these applications' });
    }

    const applications = await Application.find({ job: jobId })
      .populate('user', 'name email')
      .populate('statusUpdatedBy', 'name');
    
    res.status(200).json({ applications });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ Update application status (Employer)
router.put('/status/:applicationId', authMiddleware, isEmployer, async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { status } = req.body;

    const application = await Application.findById(applicationId).populate('job');
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Check if the employer owns the job this application is for
    if (application.job.postedBy.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to update this application' });
    }

    // Update the application status
    application.status = status;
    application.statusUpdatedAt = Date.now();
    application.statusUpdatedBy = req.user.userId;
    await application.save();

    res.status(200).json({ message: 'Application status updated', application });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get resume for an application (Employer only)
router.get('/resume/:applicationId', authMiddleware, isEmployer, async (req, res) => {
  try {
    const { applicationId } = req.params;
    const application = await Application.findById(applicationId).populate('job');
    
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Check if the employer owns the job this application is for
    if (application.job.postedBy.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to view this resume' });
    }

    // Send the resume file path
    res.status(200).json({ resumePath: application.resume });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload Resume
router.post('/resume', authMiddleware, upload.single('resume'), async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    user.resume = `uploads/resumes/${req.file.filename}`;
    await user.save();
    res.status(200).json({ success: true, resume: user.resume });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
