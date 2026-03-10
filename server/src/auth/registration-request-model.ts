import mongoose from "mongoose";
import { IRegistrationRequest } from "../types/auth.types";

const registrationRequestSchema = new mongoose.Schema<IRegistrationRequest>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    requestedRole: { type: String, enum: ["student", "teacher", "admin"], default: "student", required: true },
    birthdate: { type: Date, required: false },
  },
  { timestamps: true }
);

const registrationRequestModel = mongoose.model<IRegistrationRequest>("RegistrationRequest", registrationRequestSchema);

export default registrationRequestModel;
