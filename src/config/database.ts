import mongoose from 'mongoose';

export const connectDatabase = async (): Promise<void> => {
  // Get connection string from environment or use default
  const mongoUri =
    process.env.MONGODB_URI || 'mongodb://localhost:27017/uk-bonn-survey';
  const isAtlas = mongoUri.includes('mongodb+srv');

  try {
    // Connection options based on MongoDB Atlas recommended settings
    // Adapted from MongoDB native driver best practices
    const options: mongoose.ConnectOptions = {
      // Connection pool settings (similar to MongoClient)
      maxPoolSize: 10, // Maintain up to 10 socket connections
      minPoolSize: 2, // Maintain at least 2 socket connections

      // Timeout settings
      serverSelectionTimeoutMS: 10000, // How long to try selecting a server (increased for Atlas)
      socketTimeoutMS: 45000, // How long a send or receive on a socket can take before timeout
      connectTimeoutMS: 10000, // How long to wait for initial connection

      // Retry settings (recommended for Atlas)
      retryWrites: true, // Retry write operations
      retryReads: true, // Retry read operations

      // For MongoDB Atlas, use recommended settings
      ...(isAtlas && {
        // Atlas-specific optimizations
        bufferCommands: false, // Disable mongoose buffering (recommended for Atlas)
      }),
    };

    // Connect the client to the server (similar to MongoClient.connect())
    await mongoose.connect(mongoUri, options);

    // Send a ping to confirm a successful connection
    // This matches the pattern from the MongoDB driver sample
    if (mongoose.connection.db) {
      await mongoose.connection.db.admin().command({ ping: 1 });
    }

    const connectionType = isAtlas ? 'MongoDB Atlas' : 'Local MongoDB';
    console.log(`✅ ${connectionType} connected successfully!`);
    console.log(
      `   Pinged your deployment. You successfully connected to MongoDB!`
    );
    console.log(`   Database: ${mongoose.connection.name}`);
    console.log(`   Host: ${mongoose.connection.host}`);
  } catch (error: any) {
    console.error('❌ MongoDB connection error:', error);
    console.error('\n💡 Connection tips:');
    if (isAtlas) {
      console.error('   - Check your connection string in .env file');
      console.error(
        '   - Verify IP address is whitelisted in Atlas Network Access'
      );
      console.error('   - Ensure database user credentials are correct');
      console.error('   - Check if cluster is running (not paused)');
      console.error(
        '   - Format: mongodb+srv://username:password@cluster.mongodb.net/database'
      );
    } else {
      console.error('   - Ensure MongoDB is running locally (mongod)');
      console.error('   - Check if MongoDB service is started');
    }
    console.error('   - Verify MONGODB_URI in your .env file');
    process.exit(1);
  }

  // Handle connection events
  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB disconnected. Attempting to reconnect...');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('✅ MongoDB reconnected successfully');
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    await mongoose.connection.close();
    console.log('MongoDB connection closed through app termination');
    process.exit(0);
  });
};


