import mongoose, { Schema } from "mongoose";
import { ISubject } from "../types/subject.types";

const subjectSchema = new mongoose.Schema<ISubject>(
  {
    name: { type: String, required: true, trim: true },
    teacher: { type: Schema.Types.ObjectId, ref: "User", required: false, default: null },
    materials: [
      {
        title: { type: String, required: true, trim: true },
        url: { type: String, required: true },
        storagePath: { type: String, required: true },
        size: { type: Number, required: true },
        mimeType: { type: String, required: true },
        uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

const subjectModel = mongoose.model<ISubject>("Subject", subjectSchema);

export default subjectModel;
