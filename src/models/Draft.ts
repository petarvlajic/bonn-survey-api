import mongoose, { Schema, Document } from 'mongoose';

export interface IDraft extends Document {
  surveyId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  responseId?: mongoose.Types.ObjectId;
  data: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const DraftSchema = new Schema<IDraft>(
  {
    surveyId: {
      type: Schema.Types.ObjectId,
      ref: 'Survey',
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    responseId: {
      type: Schema.Types.ObjectId,
      ref: 'Response',
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
DraftSchema.index({ surveyId: 1 });
DraftSchema.index({ userId: 1 });
DraftSchema.index({ responseId: 1 });

export const Draft = mongoose.model<IDraft>('Draft', DraftSchema);

