import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Configuration from '../src/models/Configuration.js';
import logger from '../src/config/logger.js';

// Load environment variables
dotenv.config();

/**
 * Seed configuration with default values
 */
async function seedConfig() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI;
    
    if (!mongoUri) {
      console.error('❌ MONGO_URI environment variable is required');
      process.exit(1);
    }
    
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
    
    // Upsert default configuration
    console.log('🌱 Seeding configuration...');
    const config = await Configuration.upsertDefaults();
    
    // Log the final stored config (with redacted secrets)
    const publicConfig = {
      _id: config._id,
      siteName: config.siteName,
      defaultLanguage: config.defaultLanguage,
      enableRegistration: config.enableRegistration,
      supportEmail: config.supportEmail,
      apiKeys: {
        openai: config.apiKeys.openai ? "****" : "",
        stripe: config.apiKeys.stripe ? "****" : ""
      },
      runtime: config.runtime,
      updatedAt: config.updatedAt
    };
    
    console.log('✅ Configuration seeded successfully:');
    console.log(JSON.stringify(publicConfig, null, 2));
    
    // Close connection
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding configuration:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the seed function
seedConfig();
