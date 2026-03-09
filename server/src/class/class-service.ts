import { ClassModel } from "./class-model";
import userModel from "../user/user-model";
import type { IClassResponse, IClassDetail } from "../types/class.types";
import mongoose from "mongoose";

export class ClassService {
  static async getAllClasses(): Promise<IClassResponse[]> {
    const classes = await ClassModel.find()
      .populate("formTeacher", "name email")
      .sort({ grade: 1 });

    const classesWithCounts = await Promise.all(
      classes.map(async (cls) => {
        const studentCount = await userModel.countDocuments({
          grade: cls.grade,
          role: "student",
          isArchived: { $ne: true },
        });

        return {
          id: cls._id?.toString() || "",
          grade: cls.grade,
          formTeacher: cls.formTeacher
            ? {
                id: (cls.formTeacher as any)._id?.toString() || "",
                name: (cls.formTeacher as any).name,
                email: (cls.formTeacher as any).email,
              }
            : undefined,
          studentCount,
          createdAt: cls.createdAt || new Date(),
        };
      })
    );

    return classesWithCounts;
  }

  static async getClass(grade: number): Promise<IClassDetail | null> {
    const cls = await ClassModel.findOne({ grade }).populate(
      "formTeacher",
      "name email"
    );

    if (!cls) return null;

    const students = await userModel.find({
      grade,
      role: "student",
      isArchived: { $ne: true },
    }).select("name email isArchived");

    return {
      id: cls._id?.toString() || "",
      grade: cls.grade,
      formTeacher: cls.formTeacher
        ? {
            id: (cls.formTeacher as any)._id?.toString() || "",
            name: (cls.formTeacher as any).name,
            email: (cls.formTeacher as any).email,
          }
        : undefined,
      studentCount: students.length,
      students: students.map((s: any) => ({
        id: s._id?.toString() || "",
        name: s.name,
        email: s.email,
        isArchived: s.isArchived,
      })),
      createdAt: cls.createdAt || new Date(),
    };
  }

  static async setFormTeacher(grade: number, teacherId: string): Promise<void> {
    // Verify teacher exists and is a teacher
    const teacher = await userModel.findById(teacherId);
    if (!teacher || teacher.role !== "teacher") {
      throw new Error("Invalid teacher");
    }

    if (teacher.isArchived) {
      throw new Error("Cannot assign archived teacher");
    }

    const teacherObjectId = new mongoose.Types.ObjectId(teacherId);
    let cls = await ClassModel.findOne({ grade });
    if (!cls) {
      // Create class if it doesn't exist
      cls = await ClassModel.create({ grade, formTeacher: teacherObjectId as any });
    } else {
      cls.formTeacher = teacherObjectId as any;
      await cls.save();
    }
  }

  static async removeFormTeacher(grade: number): Promise<void> {
    const cls = await ClassModel.findOne({ grade });
    if (!cls) {
      throw new Error("Class not found");
    }

    cls.formTeacher = undefined;
    await cls.save();
  }

  static async ensureClassesExist(): Promise<void> {
    // Ensure classes 0-8 exist
    for (let i = 0; i <= 8; i++) {
      const exists = await ClassModel.findOne({ grade: i });
      if (!exists) {
        await ClassModel.create({ grade: i });
      }
    }
  }
}
