import mongoose from 'mongoose';
import app from './app.js';
import { config } from './config/index.js';

async function start() {
  if (!config.mongoUri) {
    console.error('MONGO_URI is missing. Copy .env.example to .env and fill it in.');
    process.exit(1);
  }
  await mongoose.connect(config.mongoUri);
  console.log('Database connected');
  app.listen(config.port, () => console.log(`Server running on port ${config.port}`));
}

start().catch((err) => {
  console.error('Could not start server:', err.message);
  process.exit(1);
});
