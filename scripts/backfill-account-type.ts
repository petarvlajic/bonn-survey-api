/**
 * One-time backfill: set `accountType` on existing users that predate the field.
 * @ukbonn.de accounts become 'staff', everything else becomes 'patient'.
 *
 * Usage:
 *   cd uk-bonn-survey-api && npx tsx scripts/backfill-account-type.ts
 *   DRY_RUN=1 npx tsx scripts/backfill-account-type.ts   # report only, no writes
 *
 * Requires .env with MONGODB_URI (same as the running API).
 */
import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { User } from '../src/models/User';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

async function main(): Promise<void> {
  const dryRun = process.env.DRY_RUN === '1' || process.argv.includes('--dry-run');
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');

  await mongoose.connect(uri);

  const users = await User.find({ accountType: { $exists: false } }).select('email');
  console.log(`Found ${users.length} user(s) without accountType.`);

  let staffCount = 0;
  let patientCount = 0;
  for (const user of users) {
    const accountType = user.email.trim().toLowerCase().endsWith('@ukbonn.de') ? 'staff' : 'patient';
    if (accountType === 'staff') staffCount += 1;
    else patientCount += 1;
    console.log(`${dryRun ? '[dry-run] ' : ''}${user.email} -> ${accountType}`);
    if (!dryRun) {
      user.accountType = accountType;
      await user.save();
    }
  }

  console.log(`Done. staff=${staffCount} patient=${patientCount}${dryRun ? ' (dry run, nothing written)' : ''}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
