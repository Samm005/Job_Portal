const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const authMiddleware = require('../middleware/auth');
const User = require('../models/User');

// Setup multer for profile photos
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/profiles/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const profileUpload = multer({ storage: profileStorage });

// Setup multer for resumes
const resumeStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/resumes/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const resumeUpload = multer({ storage: resumeStorage });

// ✅ Upload Profile Photo
router.post('/profile-photo', authMiddleware, profileUpload.single('photo'), async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    user.profilePhoto = `uploads/profiles/${req.file.filename}`;
    await user.save();
    res.status(200).json({ success: true, photo: user.profilePhoto });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ✅ Upload Resume
router.post('/resume', authMiddleware, resumeUpload.single('resume'), async (req, res) => {
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
