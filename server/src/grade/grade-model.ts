import mongoose from "mongoose";
import type { IGrade } from "../types/grade.types";

const gradeSchema = new mongoose.Schema<IGrade>(
  {
    grade: {
      type: Number,
      required: true,
      unique: true,
      min: 0,
      max: 8,
    },
    formTeacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      validate: {
        async validator(teacherId: string) {
          if (!teacherId) return true;
          const user = await mongoose.model("User").findById(teacherId);
          return user && user.role === "teacher";
        },
        message: "Класний керівник має бути дійсним користувачем з роллю вчителя",
      },
    },
  },
  {
    timestamps: true,
  }
);

export const GradeModel = mongoose.model<IGrade>("Grade", gradeSchema);
