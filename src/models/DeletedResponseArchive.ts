import mongoose, { Document, Schema } from 'mongoose';

export interface IDeletedResponseArchive extends Document {
  originalResponseId: mongoose.Types.ObjectId;
  pid?: string;
  deletionReason: string;
  deletedBy: mongoose.Types.ObjectId;
  deletedAt: Date;
  intervieweeName?: string;
  intervieweeEmail?: string;
  workflowStatusAtDelete?: string;
  snapshot?: Record<string, unknown>;
}

const DeletedResponseArchiveSchema = new Schema<IDeletedResponseArchive>(
  {
    originalResponseId: { type: Schema.Types.ObjectId, required: true, index: true },
    pid: { type: String, trim: true, index: true },
    deletionReason: { type: String, required: true, trim: true },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deletedAt: { type: Date, default: Date.now, index: true },
    intervieweeName: { type: String, trim: true },
    intervieweeEmail: { type: String, trim: true },
    workflowStatusAtDelete: { type: String, trim: true },
    snapshot: { type: Schema.Types.Mixed },
  },
  { collection: 'deleted_response_archives' }
);

export const DeletedResponseArchive = mongoose.model<IDeletedResponseArchive>(
  'DeletedResponseArchive',
  DeletedResponseArchiveSchema
);
