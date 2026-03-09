import userModel from "./user-model";
import { IUser, IUserResponse, UserRole } from "../types/user.types";
import { GradeModel } from "../grade/grade-model";
import bcrypt from "bcryptjs";
import journalModel from "../journal/journal-model";
import mongoose from "mongoose";
import subjectModel from "../subject/subject-model";

interface IPerformancePoint {
  subjectId: string;
  subjectName: string;
  date: string;
  value: number;
}

export default new class UserService {
  async fetchUserData(includeArchived = false) {
    const filter = includeArchived ? {} : { isArchived: { $ne: true } };
    const userData = await userModel.find(filter).select("-password");
    return userData;
  }

  async getUserById(userId: string): Promise<IUserResponse | null> {
    const user = await userModel.findById(userId).select("-password");
    if (!user) return null;

    return {
      id: user._id?.toString() || "",
      name: user.name,
      email: user.email,
      role: user.role,
      grade: (user as any).grade,
      isArchived: (user as any).isArchived,
      archivedAt: (user as any).archivedAt,
      createdAt: user.createdAt || new Date(),
    };
  }

  async createUser(
    name: string,
    email: string,
    password: string,
    role: UserRole = "student"
  ): Promise<IUser> {
    const existing = await userModel.findOne({ email });
    if (existing) {
      throw new Error("User already exists with this email");
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new userModel({
      name,
      email,
      password: hashedPassword,
      role,
    });

    await newUser.save();
    return newUser;
  }

  async createUserWithHash(
    name: string,
    email: string,
    passwordHash: string,
    role: UserRole = "student"
  ): Promise<IUser> {
    const newUser = new userModel({
      name,
      email,
      password: passwordHash,
      role,
    });
    await newUser.save();
    return newUser;
  }

  async updateUserRole(userId: string, role: UserRole): Promise<IUser> {
    if (!role || (role !== "student" && role !== "teacher")) {
      throw new Error("Role must be student or teacher");
    }

    const user = await userModel.findById(userId);
    if (!user) throw new Error("User not found");
    if (user.role === "admin") {
      throw new Error("Cannot change role of admin user");
    }

    user.role = role;
    await user.save();
    return user;
  }

  async getUserByEmail(email: string): Promise<IUser | null> {
    return await userModel.findOne({ email });
  }

  async updateStudentClass(userId: string, grade: number): Promise<IUser> {
    if (!Number.isInteger(grade) || grade < 0 || grade > 8) {
      throw new Error("Grade must be an integer between 0 and 8");
    }

    const user = await userModel.findById(userId);
    if (!user) throw new Error("User not found");
    if (user.role !== "student") {
      throw new Error("Only students can be assigned to a class");
    }

    const oldGrade = (user as any).grade;
    (user as any).grade = grade;
    await user.save();

    // Auto-sync student across journals when grade changes
    if (oldGrade !== grade) {
      await this.syncStudentJournalsOnGradeChange(userId, oldGrade, grade);
    }

    return user;
  }

  private async syncStudentJournalsOnGradeChange(
    userId: string,
    oldGrade: number | undefined,
    newGrade: number
  ): Promise<void> {
    const studentObjId = new mongoose.Types.ObjectId(userId);

    // Keep student in old grade journals (archived/historical data)
    // Only add student to all new grade journals (entries + lesson marks)
    const newGradeJournals = await journalModel.find({ grade: newGrade });
    for (const journal of newGradeJournals) {
      // Add to journal entries if not present
      const hasEntry = journal.entries.some((e: any) => e.student.toString() === userId);
      if (!hasEntry) {
        journal.entries.push({ student: studentObjId, mark: null } as any);
      }

      // Add to all lessons' marks if not present
      for (const lesson of journal.lessons || []) {
        const hasMark = (lesson.marks || []).some((m: any) => m.student.toString() === userId);
        if (!hasMark) {
          lesson.marks = [...(lesson.marks || []), { student: studentObjId, mark: null }] as any;
        }
      }

      await journal.save();
    }

    console.log(`[UserService] Added student ${userId} to ${newGradeJournals.length} journals in grade ${newGrade} (kept in old grade ${oldGrade} journals as archive)`);
  }

  async deleteStudent(userId: string): Promise<IUser> {
    const user = await userModel.findById(userId);
    if (!user) throw new Error("User not found");
    if (user.role === "admin") throw new Error("Cannot delete admin user");
    // Allow deletion of students and teachers
    if (user.role !== "student" && user.role !== "teacher") throw new Error("Can only delete students or teachers");

    (user as any).isArchived = true;
    (user as any).archivedAt = new Date();
    await user.save();
    return user as IUser;
  }

  async restoreUser(userId: string): Promise<IUser> {
    const user = await userModel.findById(userId);
    if (!user) throw new Error("User not found");

    (user as any).isArchived = false;
    (user as any).archivedAt = undefined;
    await user.save();
    return user as IUser;
  }

  async getTeacherClass(teacherId: string): Promise<{ id: string; grade: number } | null> {
    const gradeDoc = await GradeModel.findOne({ formTeacher: teacherId });
    if (!gradeDoc) return null;

    return {
      id: gradeDoc._id?.toString() || "",
      grade: gradeDoc.grade,
    };
  }

  private async ensureCanViewStudentPerformance(
    requester: IUserResponse,
    student: IUserResponse
  ): Promise<{ roleScope: "all" | "teacher-subjects"; teacherSubjectIds: string[] }> {
    if (student.role !== "student") {
      throw new Error("Student not found");
    }

    if (requester.role === "admin") {
      return { roleScope: "all", teacherSubjectIds: [] };
    }

    if (requester.role === "student") {
      if (requester.id !== student.id) {
        throw new Error("Forbidden");
      }
      return { roleScope: "all", teacherSubjectIds: [] };
    }

    if (requester.role === "teacher") {
      const teacherSubjects = await subjectModel
        .find({ teacher: requester.id })
        .select("_id")
        .lean();
      const teacherSubjectIds = teacherSubjects.map((subject: any) => subject._id.toString());

      if (typeof student.grade === "number") {
        const myClass = await this.getTeacherClass(requester.id);
        if (myClass && myClass.grade === student.grade) {
          return { roleScope: "all", teacherSubjectIds };
        }
      }

      if (!teacherSubjectIds.length) {
        throw new Error("Forbidden");
      }

      return { roleScope: "teacher-subjects", teacherSubjectIds };
    }

    throw new Error("Forbidden");
  }

  async getStudentPerformance(
    requesterId: string,
    studentId: string,
    subjectId?: string
  ): Promise<IPerformancePoint[]> {
    const requester = await this.getUserById(requesterId);
    if (!requester) {
      throw new Error("Unauthorized");
    }

    const student = await this.getUserById(studentId);
    if (!student) {
      throw new Error("Student not found");
    }

    const accessScope = await this.ensureCanViewStudentPerformance(requester, student);

    const studentObjectId = new mongoose.Types.ObjectId(studentId);
    const journalFilter: any = { entries: { $elemMatch: { student: studentObjectId } } };
    if (subjectId) {
      journalFilter.subject = new mongoose.Types.ObjectId(subjectId);
    }

    if (accessScope.roleScope === "teacher-subjects") {
      if (subjectId) {
        if (!accessScope.teacherSubjectIds.includes(subjectId)) {
          throw new Error("Forbidden");
        }
      } else {
        const subjectObjectIds = accessScope.teacherSubjectIds.map(
          (id) => new mongoose.Types.ObjectId(id)
        );
        journalFilter.subject = { $in: subjectObjectIds };
      }
    }

    const journals = await journalModel
      .find(journalFilter)
      .lean();

    if (accessScope.roleScope === "teacher-subjects" && !journals.length) {
      throw new Error("Forbidden");
    }

    if (!journals.length) {
      return [];
    }

    const subjectIds = Array.from(
      new Set(journals.map((journal: any) => journal.subject?.toString()).filter(Boolean))
    );

    const subjects = await subjectModel
      .find({ _id: { $in: subjectIds } })
      .select("name")
      .lean();

    const subjectNameById = new Map<string, string>(
      subjects.map((subject: any) => [subject._id.toString(), subject.name])
    );

    const points: IPerformancePoint[] = [];

    journals.forEach((journal: any) => {
      const subjectId = journal.subject?.toString() || "";
      const subjectName = subjectNameById.get(subjectId) || "Невідомий предмет";

      (journal.lessons || []).forEach((lesson: any) => {
        const ownMark = (lesson.marks || []).find(
          (mark: any) => mark.student?.toString() === studentId
        );

        if (!ownMark) return;
        if (ownMark.isAbsent) return;
        if (ownMark.mark === null || ownMark.mark === undefined) return;

        points.push({
          subjectId,
          subjectName,
          date: new Date(lesson.date || new Date()).toISOString(),
          value: Number(ownMark.mark),
        });
      });
    });

    return points.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }
};