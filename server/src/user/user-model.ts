import mongoose from "mongoose";
import { IUser } from "../types/user.types";

const userSchema = new mongoose.Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: false, trim: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["student", "teacher", "admin"], default: "student", required: true },
    grade: { type: Number, min: 0, max: 8, required: false },
    accountNumber: { type: String, required: false },
    birthdate: { type: Date, required: false },
    dateOfBirth: { type: Date, required: false },
    parentContact: { type: String, required: false },
    phone: { type: String, required: false },
    isArchived: { type: Boolean, required: false, default: false },
    archivedAt: { type: Date, required: false },
    passwordResetToken: { type: String, required: false },
    passwordResetExpires: { type: Date, required: false },
  },
  { timestamps: true }
);

// Keep unique emails only for non-empty string values.
userSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: {
      email: { $exists: true, $type: "string" },
    },
  }
);

const userModel = mongoose.model<IUser>("User", userSchema);

export default userModel;