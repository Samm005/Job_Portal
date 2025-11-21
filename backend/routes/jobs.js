const express = require('express');
const router = express.Router();
const Job = require('../models/Job');
const authMiddleware = require('../middleware/auth');
const User = require('../models/User');

// POST /api/jobs - Create a new job
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, description, location, salary, experience } = req.body;
    
    // Get the employer's information
    const employer = await User.findById(req.user.userId);
    if (!employer || !employer.companyName) {
      return res.status(400).json({ 
        message: 'Company name not found. Please update your employer profile first.' 
      });
    }

    const job = new Job({
      title,
      description,
      location,
      salary,
      experience,
      postedBy: req.user.userId,
      company: employer.companyName
    });
    
    await job.save();
    res.status(201).json(job);
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET /api/jobs - Get all jobs for jobseekers
router.get('/', authMiddleware, async (req, res) => {
  try {
    const jobs = await Job.find().populate('postedBy', 'companyName');
    console.log('Jobs from backend:', jobs);
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/jobs/dashboard - Get jobs posted by the logged-in employer
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      console.error('No userId in req.user:', req.user);
      return res.status(401).json({ message: 'Unauthorized: No userId' });
    }
    console.log('Fetching jobs for employer:', req.user.userId);
    const jobs = await Job.find({ postedBy: req.user.userId });
    console.log('Jobs found:', jobs);
    res.json(jobs);
  } catch (error) {
    console.error('Error in /api/jobs/dashboard:', error);
    res.status(500).json({ message: error.message, stack: error.stack });
  }
});

module.exports = router; 