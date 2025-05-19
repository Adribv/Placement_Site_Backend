const jwt = require('jsonwebtoken');
const Staff = require('../MODELS/staffSchema');

const staffAuth = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if it's a staff token
    if (decoded.role !== 'staff') {
      return res.status(403).json({ message: 'Not authorized as staff' });
    }
    
    // Find staff by id
    const staff = await Staff.findById(decoded.id).select('-password');
    if (!staff) {
      return res.status(404).json({ message: 'Staff not found' });
    }
    
    // Attach staff object to request
    req.staff = {
      id: staff._id,
      name: staff.name,
      email: staff.email,
      location: staff.location,
      role: staff.role
    };
    
    next();
  } catch (error) {
    console.error('Staff auth error:', error);
    res.status(401).json({ message: 'Token is not valid' });
  }
};

module.exports = staffAuth; 