import { GradeModel } from "./grade-model";
import userModel from "../user/user-model";
import type { IGradeResponse, IGradeDetail } from "../types/grade.types";
import mongoose from "mongoose";

export class GradeService {
  static async getAllGrades(): Promise<IGradeResponse[]> {
    const grades = await GradeModel.find()
      .populate("formTeacher", "name email")
      .sort({ grade: 1 });

    const gradesWithCounts = await Promise.all(
      grades.map(async (grade) => {
        const studentCount = await userModel.countDocuments({
          grade: grade.grade,
          role: "student",
          isArchived: { $ne: true },
        });

        return {
          id: grade._id?.toString() || "",
          grade: grade.grade,
          formTeacher: grade.formTeacher
            ? {
                id: (grade.formTeacher as any)._id?.toString() || "",
                name: (grade.formTeacher as any).name,
                email: (grade.formTeacher as any).email,
              }
            : undefined,
          studentCount,
          createdAt: grade.createdAt || new Date(),
        };
      })
    );

    return gradesWithCounts;
  }

  static async getGrade(gradeNumber: number): Promise<IGradeDetail | null> {
    const grade = await GradeModel.findOne({ grade: gradeNumber }).populate(
      "formTeacher",
      "name email"
    );

    if (!grade) return null;

    const students = await userModel.find({
      grade: gradeNumber,
      role: "student",
      isArchived: { $ne: true },
    }).select("name email isArchived");

    return {
      id: grade._id?.toString() || "",
      grade: grade.grade,
      formTeacher: grade.formTeacher
        ? {
            id: (grade.formTeacher as any)._id?.toString() || "",
            name: (grade.formTeacher as any).name,
            email: (grade.formTeacher as any).email,
          }
        : undefined,
      studentCount: students.length,
      students: students.map((s: any) => ({
        id: s._id?.toString() || "",
        name: s.name,
        email: s.email,
        isArchived: s.isArchived,
      })),
      createdAt: grade.createdAt || new Date(),
    };
  }

  static async setFormTeacher(gradeNumber: number, teacherId: string): Promise<void> {
    // Verify teacher exists and is a teacher
    const teacher = await userModel.findById(teacherId);
    if (!teacher || teacher.role !== "teacher") {
      throw new Error("Невалідний вчитель");
    }

    if (teacher.isArchived) {
      throw new Error("Не можна призначити архівного вчителя");
    }

    const teacherObjectId = new mongoose.Types.ObjectId(teacherId);
    let grade = await GradeModel.findOne({ grade: gradeNumber });
    if (!grade) {
      // Create grade if it doesn't exist
      grade = await GradeModel.create({ grade: gradeNumber, formTeacher: teacherObjectId as any });
    } else {
      grade.formTeacher = teacherObjectId as any;
      await grade.save();
    }
  }

  static async removeFormTeacher(gradeNumber: number): Promise<void> {
    const grade = await GradeModel.findOne({ grade: gradeNumber });
    if (!grade) {
      throw new Error("Клас не знайдено");
    }

    grade.formTeacher = undefined;
    await grade.save();
  }

  static async ensureGradesExist(): Promise<void> {
    // Ensure grades 0-8 exist
    for (let i = 0; i <= 8; i++) {
      const exists = await GradeModel.findOne({ grade: i });
      if (!exists) {
        await GradeModel.create({ grade: i });
      }
    }
  }
}
