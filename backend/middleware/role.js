const User = require('../models/User');

// Middleware to allow only job seekers
const isJobseeker = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user && user.role === 'jobseeker') {
      return next();
    }
    return res.status(403).json({ message: 'Access denied: jobseeker role required' });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
};

// Middleware to allow only employers
const isEmployer = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user && user.role === 'employer') {
      return next();
    }
    return res.status(403).json({ message: 'Access denied: employer role required' });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { isJobseeker, isEmployer };
