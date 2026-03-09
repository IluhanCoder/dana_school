import mongoose, { Schema } from "mongoose";
import { IJournal } from "../types/journal.types";

const journalSchema = new Schema<IJournal>(
  {
    subject: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    grade: { type: Number, required: true, min: 0, max: 8 },
    entries: [
      {
        student: { type: Schema.Types.ObjectId, ref: "User", required: true },
        mark: { type: Number, required: false, min: 0, max: 12 },
      },
    ],
    lessons: [
      {
        topic: { type: String, required: true, trim: true },
        date: { type: Date, default: Date.now },
        marks: [
          {
            student: { type: Schema.Types.ObjectId, ref: "User", required: true },
            mark: { type: Number, required: false, min: 0, max: 12 },
          },
        ],
      },
    ],
  },
  { timestamps: true }
);

journalSchema.index({ subject: 1, grade: 1 }, { unique: true });

const journalModel = mongoose.model<IJournal>("Journal", journalSchema, "journals");

export default journalModel;
