import mongoose from 'mongoose';
import { User } from '../models/User';
import { hashPassword } from './password';

const KIOSK_EMAIL =
  process.env.PATIENT_KIOSK_USER_EMAIL?.trim().toLowerCase() ||
  'patient-kiosk@herz-check-bonn.internal';

let cachedUserId: mongoose.Types.ObjectId | null = null;

/**
 * Shared internal user for anonymous tablet submissions (no patient login).
 * Responses are identified by intervieweeName / intervieweeEmail / pid.
 */
export async function getPatientKioskUserId(): Promise<mongoose.Types.ObjectId> {
  if (cachedUserId) return cachedUserId;

  const envId = process.env.PATIENT_KIOSK_USER_ID?.trim();
  if (envId && mongoose.Types.ObjectId.isValid(envId)) {
    const existing = await User.findById(envId).select('_id');
    if (existing) {
      cachedUserId = existing._id as mongoose.Types.ObjectId;
      return cachedUserId;
    }
  }

  let user = await User.findOne({ email: KIOSK_EMAIL }).select('_id');
  if (!user) {
    const randomSecret = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    user = await User.create({
      email: KIOSK_EMAIL,
      password: await hashPassword(randomSecret),
      profile: {
        firstName: 'Patient',
        lastName: 'Kiosk',
      },
    });
    console.log('[patientKiosk] Created kiosk user:', KIOSK_EMAIL);
  }

  cachedUserId = user._id as mongoose.Types.ObjectId;
  return cachedUserId;
}
