const express = require('express');
const router = express.Router();
const studentController = require('../CONTROLLER/studentController');
const profilePictureUpload = require('../MIDDLEWARE/profilePictureUpload');

// Authentication routes
router.route('/login')
    .post(studentController.loginStudent);

// Student details routes
router.route('/:studentId')
    .get(studentController.getStudentDetails);

// Profile picture upload route
router.route('/:studentId/profile-picture')
    .post(profilePictureUpload.single('profilePicture'), studentController.updateProfilePicture);

// Student module performance route
router.route('/:studentId/module/:moduleId')
    .get(studentController.getStudentModulePerformance);

// Module leaderboard route
router.route('/module/:moduleId/leaderboard')
    .get(studentController.getModuleLeaderboard);

module.exports = router;