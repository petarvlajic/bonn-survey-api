import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  password: string;
  /** Dashboard: `admin` sees user list (`/api/auth/admin/users`). Default `user` for SHK staff. */
  role: 'user' | 'admin';
  profile: {
    firstName: string;
    lastName: string;
    phone?: string;
    avatar?: string;
    position?: string;
    /** Data-URL or raw base64 image — shown on exported PDF as investigator signature */
    examinerSignatureBase64?: string;
  };
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim().toLowerCase()),
        message: 'Invalid email address',
      },
    },
    password: {
      type: String,
      required: true,
      select: false, // Don't return password by default
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    profile: {
      firstName: {
        type: String,
        required: true,
        trim: true,
      },
      lastName: {
        type: String,
        required: true,
        trim: true,
      },
      phone: {
        type: String,
        trim: true,
      },
      avatar: {
        type: String,
      },
      position: {
        type: String,
        trim: true,
      },
      examinerSignatureBase64: {
        type: String,
      },
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
UserSchema.index({ email: 1 });

export const User = mongoose.model<IUser>('User', UserSchema);

