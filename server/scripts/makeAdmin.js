// Turns an existing user into an admin.
// 1. Sign up normally first (as a guest)
// 2. Run:  npm run make-admin -- you@example.com
import mongoose from 'mongoose';
import { config } from '../src/config/index.js';
import { User } from '../src/models/User.js';

const email = (process.argv[2] || '').trim().toLowerCase();
if (!email) {
  console.error('Usage: npm run make-admin -- you@example.com');
  process.exit(1);
}

await mongoose.connect(config.mongoUri);
const user = await User.findOneAndUpdate({ email }, { role: 'admin' }, { returnDocument: 'after' });
if (!user) {
  console.error(`No user found with email ${email}. Sign up first, then run this again.`);
  process.exitCode = 1;
} else {
  console.log(`Done. ${user.email} is now an admin. Log in again to get a fresh token.`);
}
await mongoose.disconnect();
