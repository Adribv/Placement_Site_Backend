const express = require('express');
const router = express.Router();
const attendanceController = require('../CONTROLLER/attendanceController');
const { auth, isAdmin, isStaff, isStudent } = require('../MIDDLEWARE/authMiddleware');
const TrainingProgress = require('../MODELS/trainingProcessSchema');
const Module = require('../MODELS/moduleSchema');

// Middleware to check if user is either admin or staff
const isAdminOrStaff = (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'staff')) {
        next();
    } else {
        res.status(403).json({
            success: false,
            message: 'Access denied. Only admin and staff can access this resource.'
        });
    }
};

// Routes accessible by both admin and staff
router.get('/logs', auth, isAdminOrStaff, attendanceController.getAllAttendanceLogs);
router.post('/mark', auth, isAdminOrStaff, attendanceController.markAttendance);

// Route for students to view their own attendance
router.get('/my-attendance', auth, isStudent, attendanceController.getMyAttendance);

// Staff routes
router.get('/module/:moduleId', auth, isStaff, attendanceController.getModuleAttendance);
router.get('/student/:studentId/logs', auth, isStaff, (req, res, next) => {
    console.log('Received request for student attendance logs');
    console.log('Student ID:', req.params.studentId);
    console.log('User role:', req.user.role);
    next();
}, attendanceController.getStudentAttendanceLogs);

// Admin routes
router.get('/admin/student/:studentId', auth, isAdmin, (req, res, next) => {
    console.log('Admin accessing student attendance');
    console.log('Student ID:', req.params.studentId);
    console.log('User role:', req.user.role);
    next();
}, attendanceController.getStudentAttendance);

// Remove the duplicate route and add the correct one
router.get('/attendance/admin/student/:studentId', auth, isAdmin, (req, res, next) => {
    console.log('Admin accessing student attendance (attendance route)');
    console.log('Student ID:', req.params.studentId);
    console.log('User role:', req.user.role);
    next();
}, attendanceController.getStudentAttendance);

// Test route to create sample attendance data (accessible by admin)
router.post('/create-test-data/:studentId', auth, isAdmin, async (req, res) => {
    try {
        const { studentId } = req.params;
        console.log('Creating test data for student:', studentId);

        // Get or create a test module
        let testModule = await Module.findOne({ title: 'Test Module' });
        if (!testModule) {
            testModule = await Module.create({
                title: 'Test Module',
                description: 'A test module for attendance',
                duration: '2 weeks'
            });
        }

        // Create test attendance records
        const testProgress = await TrainingProgress.create({
            student: studentId,
            training: testModule._id,
            attendance: [
                {
                    date: new Date(),
                    present: true,
                    remarks: 'Present for morning session'
                },
                {
                    date: new Date(Date.now() - 86400000), // Yesterday
                    present: false,
                    remarks: 'Absent due to illness'
                },
                {
                    date: new Date(Date.now() - 172800000), // 2 days ago
                    present: true,
                    remarks: 'Present for full day'
                }
            ],
            examScores: [],
            averageScore: 0
        });

        console.log('Test data created:', testProgress);

        res.status(201).json({
            success: true,
            message: 'Test data created successfully',
            data: testProgress
        });
    } catch (error) {
        console.error('Error creating test data:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating test data',
            error: error.message
        });
    }
});

module.exports = router; 