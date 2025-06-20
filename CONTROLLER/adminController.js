const Admin = require('../MODELS/adminSchema');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Student = require('../MODELS/studentSchema');
const Module = require('../MODELS/moduleSchema');
const TrainingProgress = require('../MODELS/trainingProcessSchema');
const XLSX = require('xlsx');
const fs = require('fs');
const mongoose = require('mongoose');

const JWT_SECRET = process.env.JWT_SECRET;

// Register Admin
const registerAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ message: 'Admin already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newAdmin = new Admin({
      name,
      email,
      password: hashedPassword
    });

    await newAdmin.save();

    res.status(201).json({ message: 'Admin registered successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error during registration', error });
  }
};

// Login Admin
const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find admin
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign({ id: admin._id, email: admin.email, role: 'admin' }, JWT_SECRET, {
      expiresIn: '7d'
    });

    res.status(200).json({
      message: 'Login successful',
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during login', error });
  }
};

// 👤 Register Single Student
const registerStudent = async (req, res) => {
  try {
    const { name, regNo, email, batch, passoutYear, department, location } = req.body;

    // check for duplicate regNo
    const existing = await Student.findOne({ regNo });
    if (existing) return res.status(400).json({ message: 'Student already exists' });

    const hashedPassword = await bcrypt.hash(regNo, 10);

    const newStudent = new Student({
      name,
      regNo,
      email,
      password: hashedPassword,
      batch,
      passoutYear,
      department,
      location
    });

    await newStudent.save();
    res.status(201).json({ message: 'Student registered successfully' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
};
// 📥 Register Students in Bulk (Excel Upload)
const bulkRegisterStudents = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const filePath = req.file.path;
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const studentsData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    // Batch code mapping
    const batchMap = {
      'M': 'Marquee',
      'S': 'Super Dream',
      'D': 'Dream',
      'Se': 'Service',
      'NA': 'General'
    };

    const validStudents = [];
    const errors = [];

    await Promise.all(studentsData.map(async (student, idx) => {
      // Map Excel columns to schema fields
      const regNo = student['Register N']?.toString().trim();
      const name = student['Name']?.toString().trim();
      const department = student['Departme']?.toString().trim();
      const location = student['Location']?.toString().trim();
      const batchCode = student['Batch']?.toString().trim();
      const passoutYear = student['Passout Ye']?.toString().trim();
      const email = student['email']?.toString().trim();
      const batch = batchMap[batchCode] || batchCode;

      // Skip completely empty rows
      if (!name && !regNo && !department && !location && !batchCode && !passoutYear && !email) {
        return;
      }

      // Check for missing fields
      if (!name || !regNo || !email || !department || !location || !batch || !passoutYear) {
        errors.push({ row: idx + 2, error: 'Missing required fields', data: student });
        return;
      }

      const hashedPassword = await bcrypt.hash(regNo, 10);
      validStudents.push({
        name,
        regNo,
        email,
        batch,
        passoutYear,
        department,
        location,
        password: hashedPassword
      });
    }));

    if (validStudents.length > 0) {
      await Student.insertMany(validStudents);
    }
    fs.unlinkSync(filePath);
    res.status(201).json({
      message: 'Bulk upload completed',
      successCount: validStudents.length,
      errorCount: errors.length,
      errors
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Bulk registration failed', error: err.message });
  }
};

// Get all students
const getAllStudents = async (req, res) => {
  try {
    const { batch, location } = req.query;
    
    // Build filter object based on provided query parameters
    const filter = {};
    if (batch) filter.batch = batch;
    if (location) filter.location = location;
    
    const students = await Student.find(filter, '-password');
    res.status(200).json({ students });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching students', error: error.message });
  }
};

// Get student details
const getStudentDetails = async (req, res) => {
  try {
    const { studentId } = req.params;
    
    const student = await Student.findById(studentId)
      .select('-password')
      .populate('trainings.moduleId', 'title description');
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    res.status(200).json({
      success: true,
      data: student
    });
  } catch (error) {
    console.error('Error fetching student details:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching student details',
      error: error.message
    });
  }
};

// Add new training module
const addTrainingModule = async (req, res) => {
  try {
    const { title, description, durationDays, examsCount, location, studentIds } = req.body;
    
    // Validate studentIds
    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ message: 'Student IDs array is required' });
    }

    // Validate location
    if (!location) {
      return res.status(400).json({ message: 'Location is required' });
    }

    // Create new module
    const newModule = new Module({
      title,
      description,
      durationDays,
      examsCount,
      location
    });

    await newModule.save();

    // Update students with the new module
    const updateStudents = await Student.updateMany(
      { _id: { $in: studentIds } },
      { $push: { trainings: { moduleId: newModule._id } } }
    );

    if (updateStudents.modifiedCount === 0) {
      return res.status(400).json({ message: 'No students were updated' });
    }

    // Create training progress entries for each student
    const trainingProgressPromises = studentIds.map(studentId => {
      const progress = new TrainingProgress({
        student: studentId,
        training: newModule._id,
        attendance: [],
        examScores: Array(examsCount).fill().map((_, index) => ({
          exam: index + 1,
          score: 0
        })),
        averageScore: 0
      });
      return progress.save();
    });

    await Promise.all(trainingProgressPromises);

    res.status(201).json({ 
      message: 'Training module added and assigned to students successfully', 
      module: newModule,
      studentsAssigned: updateStudents.modifiedCount
    });
  } catch (error) {
    res.status(500).json({ message: 'Error adding training module', error: error.message });
  }
};

// Get all training modules
const getAllModules = async (req, res) => {
  try {
    const modules = await Module.find({});
    res.status(200).json({ modules });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching modules', error: error.message });
  }
};

// Update training module
const updateModule = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, durationDays, examsCount } = req.body;

    const updatedModule = await Module.findByIdAndUpdate(
      id,
      { title, description, durationDays, examsCount },
      { new: true }
    );

    if (!updatedModule) {
      return res.status(404).json({ message: 'Module not found' });
    }

    res.status(200).json({ message: 'Module updated successfully', module: updatedModule });
  } catch (error) {
    res.status(500).json({ message: 'Error updating module', error: error.message });
  }
};

// Get students by module ID
const getStudentsByModule = async (req, res) => {
  try {
    const { moduleId } = req.params;

    // Find all students who have this module in their trainings array
    const students = await Student.find(
      { 'trainings.moduleId': moduleId },
      '-password'
    ).populate({
      path: 'trainings.moduleId',
      select: 'title description durationDays examsCount'
    });

    if (!students || students.length === 0) {
      return res.status(404).json({ message: 'No students found for this module' });
    }

    // Get training progress for each student
    const studentsWithProgress = await Promise.all(
      students.map(async (student) => {
        const progress = await TrainingProgress.findOne({
          student: student._id,
          training: moduleId
        });

        return {
          ...student.toObject(),
          trainingProgress: progress || null
        };
      })
    );

    res.status(200).json({
      message: 'Students retrieved successfully',
      students: studentsWithProgress
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching students by module', error: error.message });
  }
};

// Bulk upload exam scores
const bulkUploadScores = async (req, res) => {
  try {
    const { moduleId, examNumber } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: 'No marks file uploaded' });
    }

    if (!moduleId || examNumber === undefined) {
      if (req.file) fs.unlinkSync(req.file.path); // Clean up file if validation fails
      return res.status(400).json({ message: 'Module ID and exam number are required' });
    }

    const filePath = req.file.path;
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const scoresData = XLSX.utils.sheet_to_json(sheet);

    // Validate required columns
    const requiredColumns = ['regNo', 'name', 'mark'];
    const hasAllColumns = requiredColumns.every(col => 
      Object.keys(scoresData[0] || {}).includes(col)
    );

    if (!hasAllColumns) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.status(400).json({ message: 'Excel file must contain regNo, name, and mark columns' });
    }

    try {
      // Process each student's score
      const updatePromises = scoresData.map(async (row) => {
        try {
          const student = await Student.findOne({ regNo: row.regNo.trim() });
          
          if (!student) {
            return null;
          }

          const progress = await TrainingProgress.findOne({
            student: student._id,
            training: moduleId
          });

          if (!progress) {
            return null;
          }

          // Find the exam score to update
          const examIndex = progress.examScores.findIndex(score => 
            Number(score.exam) === Number(examNumber)
          );

          if (examIndex === -1) {
            return null;
          }

          // Update the specific exam score
          progress.examScores[examIndex].score = Number(row.mark)*2;

          // Update average score
          const totalScore = progress.examScores.reduce((sum, exam) => sum + exam.score, 0);
          progress.averageScore = progress.examScores.length > 0 ? totalScore / progress.examScores.length : 0;

          // Save the updated progress
          const updatedProgress = await progress.save();
          return updatedProgress;
        } catch (error) {
          return null;
        }
      });

      const results = await Promise.all(updatePromises);
      const successfulUpdates = results.filter(result => result !== null);

      res.status(200).json({
        message: 'Scores uploaded successfully',
        totalRecords: scoresData.length,
        successfulUpdates: successfulUpdates.length,
        failedUpdates: scoresData.length - successfulUpdates.length,
        details: successfulUpdates.map(update => ({
          studentId: update.student,
          examScores: update.examScores
        }))
      });
    } catch (error) {
      throw error;
    } finally {
      // Always clean up the file after processing
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  } catch (error) {
    // Clean up file in case of error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: 'Error uploading scores', error: error.message });
  }
};

// Upload individual score
const uploadIndividualScore = async (req, res) => {
  try {
    const { studentId, moduleId, examNumber, score } = req.body;

    if (!studentId || !moduleId || examNumber === undefined || score === undefined) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Find the training progress
    const progress = await TrainingProgress.findOne({
      student: studentId,
      training: moduleId
    });

    if (!progress) {
      return res.status(404).json({ message: 'No training progress found' });
    }

    // Find the exam score to update - convert both to numbers for comparison
    const examIndex = progress.examScores.findIndex(score => 
      Number(score.exam) === Number(examNumber)
    );

    if (examIndex === -1) {
      return res.status(400).json({ message: 'Invalid exam number' });
    }

    // Update the specific exam score
    progress.examScores[examIndex].score = Number(score);

    // Update average score
    const totalScore = progress.examScores.reduce((sum, exam) => sum + exam.score, 0);
    progress.averageScore = progress.examScores.length > 0 ? totalScore / progress.examScores.length : 0;

    // Save the updated progress
    const updatedProgress = await progress.save();

    res.status(200).json({
      message: 'Score updated successfully',
      progress: {
        student: updatedProgress.student,
        training: updatedProgress.training,
        examScores: updatedProgress.examScores,
        averageScore: updatedProgress.averageScore
      }
    });
  } catch (error) {
    console.error('Error in uploadIndividualScore:', error);
    res.status(500).json({ message: 'Error updating score', error: error.message });
  }
};

// Delete student
const deleteStudent = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Find and delete the student
    const student = await Student.findByIdAndDelete(studentId);
    
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Delete associated training progress
    await TrainingProgress.deleteMany({ student: studentId });

    res.status(200).json({ 
      message: 'Student deleted successfully',
      deletedStudent: {
        id: student._id,
        name: student.name,
        regNo: student.regNo,
        email: student.email
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting student', error: error.message });
  }
};

// Update attendance for multiple students
const updateAttendance = async (req, res) => {
  try {
    const { studentIds, moduleId, date, isPresent } = req.body;

    if (!studentIds || !moduleId || !date || isPresent === undefined) {
      return res.status(400).json({ 
        message: 'Missing required fields: studentIds, moduleId, date, and isPresent are required' 
      });
    }

    // Validate date format
    const attendanceDate = new Date(date);
    if (isNaN(attendanceDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }

    // Get all students enrolled in this module
    const allStudents = await Student.find({ 'trainings.moduleId': moduleId }, '_id');
    const allStudentIds = allStudents.map(s => s._id.toString());

    // Split students into two groups
    const presentIds = isPresent ? studentIds : allStudentIds.filter(id => !studentIds.includes(id));
    const absentIds = isPresent ? allStudentIds.filter(id => !studentIds.includes(id)) : studentIds;

    // Helper to upsert attendance
    const upsertAttendance = async (studentId, present) => {
      const progress = await TrainingProgress.findOne({ student: studentId, training: moduleId });
      if (!progress) return { studentId, status: 'failed', message: 'No training progress found' };
      const existingIndex = progress.attendance.findIndex(a => a.date.toISOString().split('T')[0] === attendanceDate.toISOString().split('T')[0]);
      if (existingIndex !== -1) {
        progress.attendance[existingIndex].present = present;
      } else {
        progress.attendance.push({ date: attendanceDate, present });
      }
      await progress.save();
      return { studentId, status: 'success', present };
    };

    // Update attendance for all students
    const presentPromises = presentIds.map(id => upsertAttendance(id, true));
    const absentPromises = absentIds.map(id => upsertAttendance(id, false));
    const results = await Promise.all([...presentPromises, ...absentPromises]);
    const successfulUpdates = results.filter(r => r.status === 'success');

    res.status(200).json({
      message: 'Attendance update completed',
      totalStudents: allStudentIds.length,
      successfulUpdates: successfulUpdates.length,
      failedUpdates: allStudentIds.length - successfulUpdates.length,
      details: results
    });
  } catch (error) {
    console.error('Error updating attendance:', error);
    res.status(500).json({ 
      message: 'Error updating attendance', 
      error: error.message 
    });
  }
};

// Update module details
const updateModuleDetails = async (req, res) => {
  try {
    const { moduleId } = req.params;
    const { title, description, durationDays, examsCount, isCompleted } = req.body;

    // Validate required fields
    if (!title || !description || !durationDays || !examsCount) {
      return res.status(400).json({ 
        message: 'Missing required fields: title, description, durationDays, and examsCount are required' 
      });
    }

    // Find and update the module
    const updatedModule = await Module.findByIdAndUpdate(
      moduleId,
      {
        title,
        description,
        durationDays,
        examsCount,
        isCompleted: isCompleted || false
      },
      { new: true, runValidators: true }
    );

    if (!updatedModule) {
      return res.status(404).json({ message: 'Module not found' });
    }

    res.status(200).json({
      message: 'Module updated successfully',
      module: updatedModule
    });

  } catch (error) {
    console.error('Error updating module:', error);
    res.status(500).json({ 
      message: 'Error updating module', 
      error: error.message 
    });
  }
};

// Mark module as completed
const markModuleAsCompleted = async (req, res) => {
  try {
    const { moduleId } = req.params;

    // Find and update the module
    const module = await Module.findById(moduleId);
    if (!module) {
      return res.status(404).json({ message: 'Module not found' });
    }

    // Update module status
    module.isCompleted = true;
    await module.save();

    // Find all students enrolled in this module
    const students = await Student.find({ 'trainings.moduleId': moduleId });

    // Update completed trainings count for each student
    const updatePromises = students.map(async (student) => {
      student.numTrainingsCompleted += 1;
      return student.save();
    });

    await Promise.all(updatePromises);

    res.status(200).json({
      message: 'Module marked as completed successfully',
      module: {
        _id: module._id,
        title: module.title,
        isCompleted: module.isCompleted
      },
      studentsUpdated: students.length
    });

  } catch (error) {
    res.status(500).json({ 
      message: 'Error marking module as completed', 
      error: error.message 
    });
  }
};

// Update students batch
const updateStudentsBatch = async (req, res) => {
  try {
    const { studentIds, newBatch } = req.body;

    // Validate input
    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({
        message: 'Invalid input',
        error: 'studentIds must be a non-empty array'
      });
    }

    if (!newBatch || typeof newBatch !== 'string') {
      return res.status(400).json({
        message: 'Invalid input',
        error: 'newBatch must be a string'
      });
    }

    // Validate all student IDs
    const invalidIds = studentIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        message: 'Invalid student IDs',
        error: 'Some student IDs are not valid MongoDB ObjectIds',
        invalidIds
      });
    }

    // Update all students
    const result = await Student.updateMany(
      { _id: { $in: studentIds } },
      { $set: { batch: newBatch } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        message: 'No students found',
        error: 'None of the provided student IDs exist in the database'
      });
    }

    res.status(200).json({
      message: 'Batch updated successfully',
      updatedCount: result.modifiedCount,
      totalMatched: result.matchedCount
    });

  } catch (error) {
    res.status(500).json({
      message: 'Error updating student batches',
      error: error.message
    });
  }
};

// Staff management routes
const registerStaff = async (req, res) => {
  try {
    const { name, email, location } = req.body;
    
    // Check if staff already exists
    const Staff = require('../MODELS/staffSchema');
    const existingStaff = await Staff.findOne({ email });
    if (existingStaff) {
      return res.status(400).json({ message: 'Staff with this email already exists' });
    }
    
    // Create new staff with default password '12345'
    const staff = new Staff({
      name,
      email,
      password: '12345',
      location
    });
    
    await staff.save();
    
    res.status(201).json({ message: 'Staff registered successfully' });
  } catch (error) {
    console.error('Error registering staff:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const getAllStaff = async (req, res) => {
  try {
    const Staff = require('../MODELS/staffSchema');
    const staff = await Staff.find().select('-password');
    res.status(200).json(staff);
  } catch (error) {
    console.error('Error getting all staff:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const deleteStaff = async (req, res) => {
  try {
    const { staffId } = req.params;
    const Staff = require('../MODELS/staffSchema');
    
    const staff = await Staff.findByIdAndDelete(staffId);
    if (!staff) {
      return res.status(404).json({ message: 'Staff not found' });
    }
    
    res.status(200).json({ message: 'Staff deleted successfully' });
  } catch (error) {
    console.error('Error deleting staff:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const assignStaffToModule = async (req, res) => {
  try {
    const { moduleId, staffId } = req.body;
    const Module = require('../MODELS/moduleSchema');
    const Staff = require('../MODELS/staffSchema');
    
    // Find the module and staff
    const [module, staff] = await Promise.all([
      Module.findById(moduleId),
      Staff.findById(staffId)
    ]);

    if (!module) {
      return res.status(404).json({ message: 'Module not found' });
    }

    if (!staff) {
      return res.status(404).json({ message: 'Staff not found' });
    }

    // Update module's staffAssigned array
    await Module.updateOne(
      { _id: moduleId },
      { 
        $addToSet: { staffAssigned: staffId } // $addToSet ensures no duplicates
      }
    );

    // Update staff's modules array
    await Staff.updateOne(
      { _id: staffId },
      { 
        $addToSet: { modules: moduleId } // $addToSet ensures no duplicates
      }
    );
    
    res.status(200).json({ message: 'Staff assigned to module successfully' });
  } catch (error) {
    console.error('Error assigning staff to module:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get leaderboard for all modules
const getAllModulesLeaderboard = async (req, res) => {
  try {
    // Fetch all students and their scores for all modules
    const students = await Student.find({}, '-password');
    // For a simple version, just return all students sorted by averageScore
    const leaderboard = students
      .map(student => ({
        studentId: student._id,
        name: student.name,
        regNo: student.regNo,
        department: student.department,
        averageScore: student.averageScore || 0, // or calculate as needed
        rank: 0 // will be set below
      }))
      .sort((a, b) => b.averageScore - a.averageScore);

    // Assign ranks
    leaderboard.forEach((student, idx) => {
      student.rank = idx + 1;
    });

    res.json({ leaderboard });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch all modules leaderboard', error: err.message });
  }
};

module.exports = { 
  registerAdmin, 
  loginAdmin, 
  registerStudent,
  bulkRegisterStudents,
  getAllStudents,
  getStudentDetails,
  addTrainingModule,
  getAllModules,
  updateModule,
  getStudentsByModule,
  bulkUploadScores,
  uploadIndividualScore,
  deleteStudent,
  updateAttendance,
  updateModuleDetails,
  markModuleAsCompleted,
  updateStudentsBatch,
  registerStaff,
  getAllStaff,
  deleteStaff,
  assignStaffToModule,
  getAllModulesLeaderboard
};
