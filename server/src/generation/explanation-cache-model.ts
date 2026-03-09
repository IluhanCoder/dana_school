import mongoose, { Schema } from "mongoose";

export interface IExplanationCache {
  _id?: string;
  studentId: string;
  subjectId: string;
  lessonDate: string;
  topicKey: string;
  snippetHash: string;
  materialTitle?: string | null;
  explanation: string;
  usedExternalKnowledge: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const explanationCacheSchema = new Schema<IExplanationCache>(
  {
    studentId: { type: String, required: true, index: true },
    subjectId: { type: String, required: true, index: true },
    lessonDate: { type: String, required: true },
    topicKey: { type: String, required: true },
    snippetHash: { type: String, required: true },
    materialTitle: { type: String, required: false, default: null },
    explanation: { type: String, required: true },
    usedExternalKnowledge: { type: Boolean, required: true, default: false },
  },
  { timestamps: true }
);

explanationCacheSchema.index({ studentId: 1, subjectId: 1, topicKey: 1, snippetHash: 1 }, { unique: true });

const explanationCacheModel = mongoose.model<IExplanationCache>(
  "ExplanationCache",
  explanationCacheSchema,
  "explanation_cache"
);

export default explanationCacheModel;
