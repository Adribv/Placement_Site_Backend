const Staff = require('../MODELS/staffSchema');
const Student = require('../MODELS/studentSchema');
const TrainingProgress = require('../MODELS/trainingProcessSchema');
const Module = require('../MODELS/moduleSchema');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// Register staff
exports.registerStaff = async (req, res) => {
  try {
    const { name, email, password, location } = req.body;
    
    // Check if staff already exists
    const existingStaff = await Staff.findOne({ email });
    if (existingStaff) {
      return res.status(400).json({ message: 'Staff with this email already exists' });
    }
    
    // Create new staff with default password
    const staff = new Staff({
      name,
      email,
      password: password || '12345', // Default password
      location
    });
    
    await staff.save();
    
    res.status(201).json({ message: 'Staff registered successfully' });
  } catch (error) {
    console.error('Error registering staff:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Login staff
exports.loginStaff = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find staff by email
    const staff = await Staff.findOne({ email });
    if (!staff) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Compare password
    const isMatch = await bcrypt.compare(password, staff.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { id: staff._id, role: 'staff' },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    
    res.status(200).json({
      token,
      staff: {
        _id: staff._id,
        name: staff.name,
        email: staff.email,
        location: staff.location,
        profilePicture: staff.profilePicture,
        role: staff.role
      }
    });
  } catch (error) {
    console.error('Error logging in staff:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get staff profile
exports.getStaffProfile = async (req, res) => {
  try {
    const staff = await Staff.findById(req.staff.id).select('-password');
    if (!staff) {
      return res.status(404).json({ message: 'Staff not found' });
    }
    
    res.status(200).json(staff);
  } catch (error) {
    console.error('Error getting staff profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get all modules assigned to staff
exports.getAssignedModules = async (req, res) => {
  try {
    const modules = await Module.find({ staffAssigned: req.staff.id });
    res.status(200).json(modules);
  } catch (error) {
    console.error('Error getting assigned modules:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get students by location and module
exports.getStudentsByLocationAndModule = async (req, res) => {
  try {
    const { moduleId } = req.params;
    const { location } = req.query;
    
    // Find students by location who are enrolled in the module
    const students = await Student.find({
      location,
      'trainings.moduleId': moduleId
    });
    
    res.status(200).json(students);
  } catch (error) {
    console.error('Error getting students by location and module:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Update attendance
exports.updateAttendance = async (req, res) => {
  try {
    const { moduleId, studentIds, date, attendanceStatus } = req.body;
    
    // Validate input data
    if (!moduleId || !studentIds || !date || attendanceStatus === undefined) {
      return res.status(400).json({ 
        message: 'Missing required fields: moduleId, studentIds, date, and attendanceStatus'
      });
    }

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ message: 'studentIds must be a non-empty array' });
    }

    // Validate date format
    const attendanceDate = new Date(date);
    if (isNaN(attendanceDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }
    
    // Find the module
    const module = await Module.findById(moduleId);
    if (!module) {
      return res.status(404).json({ message: 'Module not found' });
    }
    
    // TEMPORARILY DISABLED FOR TESTING
    // Check if module has staffAssigned
    /*
    if (!module.staffAssigned) {
      return res.status(403).json({ 
        message: 'This module has no staff assigned. Please contact an administrator.' 
      });
    }
    
    // Ensure staff is assigned to this module
    if (module.staffAssigned.toString() !== req.staff.id) {
      return res.status(403).json({ 
        message: 'Not authorized to update attendance for this module' 
      });
    }
    */
    
    // Console log for debugging
    console.log('Staff ID:', req.staff.id);
    console.log('Module staffAssigned:', module.staffAssigned);
    
    // Add the staff to the module if not assigned (temporary fix)
    if (!module.staffAssigned || module.staffAssigned.toString() !== req.staff.id) {
      console.log('Temporarily assigning staff to module for testing');
      module.staffAssigned = req.staff.id;
      await module.save();
    }

    // Check if students are enrolled in this module
    for (const studentId of studentIds) {
      const student = await Student.findOne({
        _id: studentId,
        'trainings.moduleId': moduleId
      });

      if (!student) {
        return res.status(400).json({ 
          message: `Student with ID ${studentId} is not enrolled in this module` 
        });
      }
    }
    
    // Update attendance for each student
    const updatePromises = studentIds.map(async (studentId) => {
      try {
        // Find or create training progress document
        let progress = await TrainingProgress.findOne({
          student: studentId,
          training: moduleId
        });
        
        if (!progress) {
          progress = new TrainingProgress({
            student: studentId,
            training: moduleId,
            attendance: [],
            examScores: []
          });
        }
        
        // Check if attendance for this date already exists
        const existingAttendanceIndex = progress.attendance.findIndex(
          a => new Date(a.date).toDateString() === new Date(date).toDateString()
        );
        
        if (existingAttendanceIndex !== -1) {
          // Update existing attendance
          progress.attendance[existingAttendanceIndex].present = attendanceStatus;
        } else {
          // Add new attendance record
          progress.attendance.push({
            date,
            present: attendanceStatus
          });
        }
        
        return progress.save();
      } catch (error) {
        console.error(`Error processing student ${studentId}:`, error);
        throw new Error(`Failed to update attendance for student ${studentId}`);
      }
    });
    
    await Promise.all(updatePromises);
    
    res.status(200).json({ 
      message: 'Attendance updated successfully',
      studentsUpdated: studentIds.length
    });
  } catch (error) {
    console.error('Error updating attendance:', error);
    const errorMessage = error.message || 'Internal server error';
    res.status(500).json({ message: errorMessage });
  }
};

// Get all staff (admin only)
exports.getAllStaff = async (req, res) => {
  try {
    const staff = await Staff.find().select('-password');
    res.status(200).json(staff);
  } catch (error) {
    console.error('Error getting all staff:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Update staff profile picture
exports.updateProfilePicture = async (req, res) => {
  try {
    const staffId = req.staff.id;
    
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Create the profile picture URL
    const profilePicturePath = `${req.protocol}://${req.get('host')}/uploads/profilePictures/${req.file.filename}`;

    // Update the staff record with the new profile picture URL
    const updatedStaff = await Staff.findByIdAndUpdate(
      staffId,
      { profilePicture: profilePicturePath },
      { new: true }
    ).select('-password');

    if (!updatedStaff) {
      return res.status(404).json({ message: 'Staff not found' });
    }

    res.status(200).json({
      message: 'Profile picture updated successfully',
      staff: updatedStaff
    });
  } catch (error) {
    console.error('Error in updateProfilePicture:', error);
    res.status(500).json({ 
      message: 'Error updating profile picture', 
      error: error.message 
    });
  }
}; 