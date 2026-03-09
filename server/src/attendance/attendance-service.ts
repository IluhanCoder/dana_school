import mongoose from "mongoose";
import attendanceModel from "./attendance-model";
import userModel from "../user/user-model";
import { GradeModel } from "../grade/grade-model";
import journalModel from "../journal/journal-model";
import { IAttendanceResponse } from "../types/attendance.types";

export default new class AttendanceService {
  private getDateRange(date: Date): { start: Date; end: Date } {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }

  async getAttendanceForClass(classId: string): Promise<IAttendanceResponse[]> {
    const records = await (attendanceModel as any)
      .find({ class: classId })
      .populate({
        path: "entries.student",
        select: "name email isArchived",
      })
      .sort({ date: -1 });

    return (records as any[]).map((record: any) => this.mapAttendance(record));
  }

  async addAttendanceRecord(classId: string, date: Date): Promise<IAttendanceResponse> {
    // Get all students in grade
    const gradeDoc = await GradeModel.findById(classId);
    if (!gradeDoc) {
      throw new Error("Grade not found");
    }

    // Check if record already exists for this date
    const existing = await (attendanceModel as any).findOne({
      class: classId,
      date,
    });
    if (existing) {
      throw new Error("Attendance record already exists for this date");
    }

    // Get students for this grade
    const students = await userModel.find({
      grade: gradeDoc.grade,
      role: "student",
      isArchived: { $ne: true },
    });

    // Create attendance record
    const record = await (attendanceModel as any).create({
      class: classId,
      date: new Date(date),
      entries: students.map((s) => ({
        student: s._id,
        present: true,
      })),
    });

    const populated = await record.populate({
      path: "entries.student",
      select: "name email isArchived",
    });

    return this.mapAttendance(populated);
  }

  async updateAttendance(
    recordId: string,
    studentId: string,
    present: boolean
  ): Promise<IAttendanceResponse> {
    const record = await (attendanceModel as any).findById(recordId);
    if (!record) {
      throw new Error("Attendance record not found");
    }

    const entry = record.entries.find(
      (e: any) => e.student.toString() === studentId
    );
    if (!entry) {
      throw new Error("Student not found in attendance record");
    }

    entry.present = present;
    await record.save();

    const populated = await record.populate({
      path: "entries.student",
      select: "name email isArchived",
    });

    let warning: string | undefined;
    if (!present && mongoose.connection.readyState === 1) {
      const gradeDoc = await GradeModel.findById(record.class);
      if (gradeDoc) {
        const { start, end } = this.getDateRange(new Date(record.date));
        const conflictJournals = await (journalModel as any)
          .find({
            grade: gradeDoc.grade,
            lessons: {
              $elemMatch: {
                date: { $gte: start, $lt: end },
                marks: {
                  $elemMatch: {
                    student: new mongoose.Types.ObjectId(studentId),
                    mark: { $ne: null },
                  },
                },
              },
            },
          })
          .select("_id")
          .lean();

        if ((conflictJournals || []).length > 0) {
          warning = "Увага: для цього учня на цю дату вже є оцінка в журналі."
        }
      }
    }

    return this.mapAttendance(populated, warning);
  }

  async deleteAttendanceRecord(recordId: string): Promise<void> {
    const record = await (attendanceModel as any).findById(recordId);
    if (!record) {
      throw new Error("Attendance record not found");
    }
    await (attendanceModel as any).findByIdAndDelete(recordId);
  }

  private mapAttendance(record: any, warning?: string): IAttendanceResponse {
    return {
      id: record._id?.toString() || "",
      date: record.date,
      entries: (record.entries || []).map((e: any) => ({
        student: {
          id: e.student?._id?.toString() || "",
          name: e.student?.name,
          email: e.student?.email,
          isArchived: e.student?.isArchived,
        },
        present: e.present,
      })),
      createdAt: record.createdAt || new Date(),
      warning,
    };
  }
}();
