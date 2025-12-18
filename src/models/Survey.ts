import mongoose, { Schema, Document } from 'mongoose';
import { QuestionType, SurveyStatus, Question, RepeatableSection, SurveySettings } from '../types';

export interface ISurvey extends Document {
  title: string;
  description?: string;
  questions: Question[];
  repeatableSections?: RepeatableSection[];
  createdBy: mongoose.Types.ObjectId;
  status: SurveyStatus;
  settings?: SurveySettings;
  createdAt: Date;
  updatedAt: Date;
}

const QuestionSchema = new Schema({
  id: { type: String, required: true },
  type: {
    type: String,
    enum: ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TEXT', 'NUMBER', 'RATING', 'DATE', 'IMAGE_UPLOAD', 'FILE_UPLOAD', 'GEOLOCATION', 'SIGNATURE'],
    required: true,
  },
  label: { type: String, required: true },
  required: { type: Boolean, default: false },
  options: [{
    id: { type: String, required: true },
    label: { type: String, required: true },
  }],
  min: Number,
  max: Number,
  placeholder: String,
  repeatable: { type: Boolean, default: false },
}, { _id: false });

const RepeatableSectionSchema = new Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  questions: [QuestionSchema],
  minRepeats: Number,
  maxRepeats: Number,
}, { _id: false });

const SurveySchema = new Schema<ISurvey>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    questions: {
      type: [QuestionSchema],
      default: [],
    },
    repeatableSections: {
      type: [RepeatableSectionSchema],
      default: [],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'completed', 'archived'],
      default: 'draft',
    },
    settings: {
      allowAnonymous: { type: Boolean, default: false },
      requireSignature: { type: Boolean, default: false },
      minSignatureStrokeLength: Number,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
SurveySchema.index({ createdBy: 1 });
SurveySchema.index({ status: 1 });
SurveySchema.index({ createdAt: -1 });

export const Survey = mongoose.model<ISurvey>('Survey', SurveySchema);

