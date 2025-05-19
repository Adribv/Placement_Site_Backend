const express = require('express');
const router = express.Router();
const staffController = require('../CONTROLLER/staffController');
const staffAuth = require('../MIDDLEWARE/staffAuth');
const profilePictureUpload = require('../MIDDLEWARE/profilePictureUpload');

// Public routes
router.post('/login', staffController.loginStaff);

// Protected routes (require authentication)
router.get('/profile', staffAuth, staffController.getStaffProfile);
router.post('/profile-picture', staffAuth, profilePictureUpload.single('profilePicture'), staffController.updateProfilePicture);
router.get('/modules', staffAuth, staffController.getAssignedModules);
router.get('/module/:moduleId/students', staffAuth, staffController.getStudentsByLocationAndModule);
router.post('/attendance', staffAuth, staffController.updateAttendance);

module.exports = router; 