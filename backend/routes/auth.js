const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const dns = require('dns');
const { promisify } = require('util');

const router = express.Router();

// Email transporter (for forgot password)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Helper function to validate email domain
async function isValidEmailDomain(email) {
  try {
    const domain = email.split('@')[1];
    
    // Basic domain format validation
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;
    if (!domainRegex.test(domain)) {
      return false;
    }

    // Check for disposable email domains
    const disposableDomains = [
      'tempmail.com', 'throwawaymail.com', 'mailinator.com',
      'temp-mail.org', 'guerrillamail.com', 'sharklasers.com'
      // Add more as needed
    ];
    if (disposableDomains.some(d => domain.toLowerCase().includes(d))) {
      return false;
    }

    // Verify MX records exist
    const resolveMx = promisify(dns.resolveMx);
    const mxRecords = await resolveMx(domain);
    
    // Additional check for valid MX records
    if (!mxRecords || mxRecords.length === 0) {
      return false;
    }

    // Verify at least one MX record has a valid priority and exchange
    const validMxRecord = mxRecords.some(record => 
      record && 
      typeof record.priority === 'number' && 
      typeof record.exchange === 'string' && 
      record.exchange.length > 0
    );

    return validMxRecord;
  } catch (error) {
    console.error('Email domain validation error:', error);
    return false;
  }
}

// Signup route
router.post('/signup', async (req, res) => {
  const { name, email, password, role, companyName } = req.body;

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        message: 'An account with this email already exists',
        field: 'email'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: 'Please enter a valid email address format',
        field: 'email',
        code: 'INVALID_FORMAT'
      });
    }

    // Check if email domain is valid
    const isValidDomain = await isValidEmailDomain(email);
    if (!isValidDomain) {
      const domain = email.split('@')[1];
      return res.status(400).json({
        message: `The email domain "${domain}" appears to be invalid or not accepting mail. Please use a valid email address.`,
        field: 'email',
        code: 'INVALID_DOMAIN'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = new User({ 
      name, 
      email, 
      password: hashedPassword, 
      role,
      companyName: role === 'employer' ? companyName : undefined
    });
    await user.save();

    const payload = {
      id: user._id,
      role: user.role,
      name: user.name,
      companyName: user.companyName
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.status(201).json({ message: 'Signup successful', token, ...payload });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Email verification route
router.get('/verify-email/:token', async (req, res) => {
  try {
    const user = await User.findOne({
      verificationToken: req.params.token,
      verificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired verification token' });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationExpires = undefined;
    await user.save();

    res.json({ message: 'Email verified successfully! You can now log in.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Login route
router.post('/login', async (req, res) => {
  const { email, password, role } = req.body;

  try {
    // Find user and check role
    const user = await User.findOne({ email, role });
    if (!user) {
      return res.status(404).json({ 
        message: 'No account found with this email and role combination',
        field: 'email'
      });
    }

    // Check password
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ 
        message: 'Incorrect password',
        field: 'password'
      });
    }

    const payload = {
      id: user._id,
      role: user.role,
      name: user.name,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.status(200).json({ token, ...payload });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ FORGOT PASSWORD
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'No user with that email' });

    const token = crypto.randomBytes(20).toString('hex');

    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();

    const resetUrl = `${process.env.CLIENT_URL}/reset-password.html?token=${token}`;

    const mailOptions = {
      to: user.email,
      from: process.env.EMAIL_USER,
      subject: 'Password Reset Request',
      html: `<p>You requested for a password reset</p><p>Click this <a href="${resetUrl}">link</a> to reset your password.</p>`
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: 'Reset link sent to your email' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ RESET PASSWORD
router.post('/reset-password/:token', async (req, res) => {
  const { password } = req.body;

  try {
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) return res.status(400).json({ message: 'Invalid or expired token' });

    const hashedPassword = await bcrypt.hash(password, 12);

    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/auth/me - Get current user info
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({
      name: user.name,
      email: user.email,
      companyName: user.companyName,
      profilePhoto: user.profilePhoto,
      resume: user.resume
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
