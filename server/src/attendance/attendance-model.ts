import mongoose, { Schema } from "mongoose";
import { IAttendanceRecord } from "../types/attendance.types";

const attendanceSchema = new Schema<IAttendanceRecord>(
  {
    class: { type: Schema.Types.ObjectId, ref: "Class", required: true },
    date: { type: Date, required: true },
    entries: [
      {
        student: { type: Schema.Types.ObjectId, ref: "User", required: true },
        present: { type: Boolean, default: true },
      },
    ],
  },
  { timestamps: true }
);

// Unique index: one record per class per date
attendanceSchema.index({ class: 1, date: 1 }, { unique: true });

const attendanceModel = mongoose.model<IAttendanceRecord>(
  "Attendance",
  attendanceSchema
);

export default attendanceModel;
