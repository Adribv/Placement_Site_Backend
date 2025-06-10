const Attendance = require('../MODELS/attendanceSchema');
const Student = require('../MODELS/studentSchema');
const TrainingProgress = require('../MODELS/trainingProcessSchema');
const Module = require('../MODELS/moduleSchema');
const mongoose = require('mongoose');

// Get attendance logs for all students
const getAllAttendanceLogs = async (req, res) => {
    try {
        const attendanceLogs = await Attendance.find()
            .populate('studentId', 'name rollNumber')
            .populate('markedBy', 'name')
            .sort({ date: -1 });
        
        res.status(200).json({
            success: true,
            data: attendanceLogs
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching attendance logs',
            error: error.message
        });
    }
};

// Get attendance logs for a specific student (for staff)
const getStudentAttendanceLogs = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { moduleId, startDate, endDate } = req.query;
        
        console.log('Fetching attendance logs for student:', studentId);
        console.log('Query parameters:', { moduleId, startDate, endDate });
        
        // Build query
        const query = { student: studentId };
        if (moduleId) query.training = moduleId;

        console.log('MongoDB query:', query);

        // Find all training progress records for the student
        const trainingProgress = await TrainingProgress.find(query)
            .populate('student', 'name rollNumber')
            .populate('training', 'title')
            .sort({ 'attendance.date': -1 });

        console.log('Found training progress records:', trainingProgress.length);

        // Transform the data into a flat array of attendance records
        let attendanceLogs = trainingProgress.flatMap(progress => 
            progress.attendance.map(record => ({
                _id: record._id || new mongoose.Types.ObjectId(),
                date: record.date,
                status: record.present ? 'present' : 'absent',
                moduleId: progress.training,
                moduleTitle: progress.training?.title || 'Unknown Module',
                studentId: progress.student,
                studentName: progress.student?.name || 'Unknown Student',
                remarks: record.remarks || '-'
            }))
        );

        console.log('Transformed attendance logs:', attendanceLogs.length);

        // Apply date filters if provided
        if (startDate || endDate) {
            attendanceLogs = attendanceLogs.filter(log => {
                const logDate = new Date(log.date);
                if (startDate && logDate < new Date(startDate)) return false;
                if (endDate) {
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    if (logDate > end) return false;
                }
                return true;
            });
            console.log('Filtered attendance logs:', attendanceLogs.length);
        }

        res.status(200).json({
            success: true,
            data: attendanceLogs
        });
    } catch (error) {
        console.error('Error in getStudentAttendanceLogs:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching student attendance logs',
            error: error.message
        });
    }
};

// Get attendance for the logged-in student
const getMyAttendance = async (req, res) => {
    try {
        const studentId = req.user._id;
        console.log('Fetching attendance for student:', studentId);
        
        // Find all training progress records for the student
        const trainingProgress = await TrainingProgress.find({ student: studentId })
            .populate('training', 'title')
            .sort({ createdAt: -1 });

        console.log('Found training progress records:', trainingProgress);

        // Transform the data to match the expected format
        const attendanceLogs = trainingProgress.flatMap(progress => {
            console.log('Processing progress record:', progress);
            return progress.attendance.map(record => ({
                _id: record._id || new mongoose.Types.ObjectId(),
                date: record.date,
                status: record.present ? 'present' : 'absent',
                moduleTitle: progress.training?.title || 'Unknown Module',
                remarks: '-'
            }));
        });

        console.log('Transformed attendance logs:', attendanceLogs);

        res.status(200).json({
            success: true,
            data: attendanceLogs
        });
    } catch (error) {
        console.error('Error in getMyAttendance:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching attendance logs',
            error: error.message
        });
    }
};

// Mark attendance for a student
const markAttendance = async (req, res) => {
    try {
        const { studentId, status, remarks } = req.body;
        const markedBy = req.user._id; // Assuming user info is available in req.user

        const attendance = await Attendance.create({
            studentId,
            date: new Date(),
            status,
            remarks,
            markedBy
        });

        res.status(201).json({
            success: true,
            data: attendance
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error marking attendance',
            error: error.message
        });
    }
};

// Get module attendance
const getModuleAttendance = async (req, res) => {
    try {
        const { moduleId } = req.params;
        const trainingProgress = await TrainingProgress.find({ training: moduleId })
            .populate('student', 'name rollNumber')
            .populate('training', 'title')
            .sort({ 'attendance.date': -1 });

        const attendanceLogs = trainingProgress.flatMap(progress => 
            progress.attendance.map(record => ({
                date: record.date,
                status: record.present ? 'present' : 'absent',
                studentName: progress.student.name,
                studentRoll: progress.student.rollNumber,
                moduleTitle: progress.training.title,
                remarks: record.remarks || ''
            }))
        );

        res.status(200).json({
            success: true,
            data: attendanceLogs
        });
    } catch (error) {
        console.error('Error in getModuleAttendance:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching module attendance',
            error: error.message
        });
    }
};

// Get student attendance (for admin)
const getStudentAttendance = async (req, res) => {
    try {
        const { studentId } = req.params;
        console.log('Fetching attendance for student:', studentId);

        // Validate studentId
        if (!studentId) {
            console.error('No studentId provided');
            return res.status(400).json({
                success: false,
                message: 'Student ID is required'
            });
        }

        // Find all training progress records for the student
        const trainingProgress = await TrainingProgress.find({ student: studentId })
            .populate('training', 'title')
            .sort({ 'attendance.date': -1 });

        console.log('Found training progress records:', trainingProgress.length);
        console.log('Training progress details:', JSON.stringify(trainingProgress, null, 2));

        if (!trainingProgress || trainingProgress.length === 0) {
            console.log('No training progress records found for student:', studentId);
            return res.status(200).json({
                success: true,
                data: []
            });
        }

        // Transform the data into a flat array of attendance records
        const attendanceLogs = trainingProgress.flatMap(progress => {
            console.log('Processing progress record:', progress._id);
            if (!progress.attendance || !Array.isArray(progress.attendance)) {
                console.log('No attendance array found in progress record:', progress._id);
                return [];
            }
            return progress.attendance.map(record => ({
                _id: record._id || new mongoose.Types.ObjectId(),
                date: record.date,
                status: record.present ? 'present' : 'absent',
                moduleTitle: progress.training?.title || 'Unknown Module',
                remarks: record.remarks || ''
            }));
        });

        console.log('Transformed attendance logs:', attendanceLogs.length);
        console.log('Attendance logs details:', JSON.stringify(attendanceLogs, null, 2));

        res.status(200).json({
            success: true,
            data: attendanceLogs
        });
    } catch (error) {
        console.error('Error in getStudentAttendance:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching student attendance',
            error: error.message
        });
    }
};

module.exports = {
    getAllAttendanceLogs,
    getMyAttendance,
    markAttendance,
    getModuleAttendance,
    getStudentAttendance,
    getStudentAttendanceLogs
}; 