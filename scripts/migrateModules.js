const mongoose = require('mongoose');
require('dotenv').config();

const Module = require('../MODELS/moduleSchema');

async function migrateModules() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.DB_URL);
    console.log('Connected to MongoDB');

    // First, update all modules to have an empty staffAssigned array
    await Module.updateMany(
      {},
      { $set: { staffAssigned: [] } }
    );
    console.log('Reset all modules to have empty staffAssigned array');

    // Find all modules that have staffAssigned as ObjectId
    const modules = await Module.find({
      staffAssigned: { $exists: true, $type: 'objectId' }
    });
    console.log(`Found ${modules.length} modules to migrate`);

    // Update each module using MongoDB's update operation
    for (const module of modules) {
      const staffId = module.staffAssigned;
      await Module.updateOne(
        { _id: module._id },
        { $set: { staffAssigned: [staffId] } }
      );
      console.log(`Migrated module ${module._id}`);
    }

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

migrateModules(); 