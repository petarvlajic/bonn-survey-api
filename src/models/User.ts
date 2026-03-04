import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  password: string;
  profile: {
    firstName: string;
    lastName: string;
    phone?: string;
    avatar?: string;
    position?: string;
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
        validator: (email: string) => email.endsWith('@ukbonn.de'),
        message: 'Email must end with @ukbonn.de',
      },
    },
    password: {
      type: String,
      required: true,
      select: false, // Don't return password by default
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

