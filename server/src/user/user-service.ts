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
  private normalizeBirthdate(value?: string | Date | null): Date | undefined {
    if (!value) return undefined;
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error("Невалідний формат дати народження");
    }

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (parsed > today) {
      throw new Error("Дата народження не може бути в майбутньому");
    }

    const oldestAllowed = new Date();
    oldestAllowed.setFullYear(oldestAllowed.getFullYear() - 100);
    oldestAllowed.setHours(0, 0, 0, 0);
    if (parsed < oldestAllowed) {
      throw new Error("Дата народження не може бути старшою за 100 років");
    }

    return parsed;
  }

  private resolveBirthdate(user: any): Date | undefined {
    return user.birthdate || user.dateOfBirth || undefined;
  }

  async fetchUserData(includeArchived = false, role?: UserRole) {
    const filter: any = includeArchived ? {} : { isArchived: { $ne: true } };
    if (role) {
      filter.role = role;
    }
    const userData = await userModel.find(filter).select("-password").lean();
    return userData.map((user: any) => ({
      ...user,
      birthdate: user.birthdate || user.dateOfBirth,
    }));
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
      birthdate: this.resolveBirthdate(user as any),
      isArchived: (user as any).isArchived,
      archivedAt: (user as any).archivedAt,
      createdAt: user.createdAt || new Date(),
    };
  }

  async createUser(
    name: string,
    email: string,
    password: string,
    role: UserRole = "student",
    options?: { birthdate?: string | Date }
  ): Promise<IUser> {
    const existing = await userModel.findOne({ email });
    if (existing) {
      throw new Error("Користувач з таким email вже існує");
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new userModel({
      name,
      email,
      password: hashedPassword,
      role,
      birthdate: this.normalizeBirthdate(options?.birthdate),
    });

    await newUser.save();
    return newUser;
  }

  async createUserWithHash(
    name: string,
    email: string,
    passwordHash: string,
    role: UserRole = "student",
    options?: { birthdate?: string | Date }
  ): Promise<IUser> {
    const newUser = new userModel({
      name,
      email,
      password: passwordHash,
      role,
      birthdate: this.normalizeBirthdate(options?.birthdate),
    });
    await newUser.save();
    return newUser;
  }

  async updateUserBirthdate(userId: string, birthdate?: string | Date | null): Promise<IUser> {
    const user = await userModel.findById(userId);
    if (!user) throw new Error("Користувача не знайдено");

    (user as any).birthdate = this.normalizeBirthdate(birthdate);
    await user.save();
    return user as IUser;
  }

  async updateUserRole(userId: string, role: UserRole): Promise<IUser> {
    if (!role || (role !== "student" && role !== "teacher")) {
      throw new Error("Роль має бути student або teacher");
    }

    const user = await userModel.findById(userId);
    if (!user) throw new Error("Користувача не знайдено");
    if (user.role === "admin") {
      throw new Error("Не можна змінити роль адміністратора");
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
      throw new Error("Клас має бути цілим числом від 0 до 8");
    }

    const user = await userModel.findById(userId);
    if (!user) throw new Error("Користувача не знайдено");
    if (user.role !== "student") {
      throw new Error("До класу можна призначати лише учнів");
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
    if (!user) throw new Error("Користувача не знайдено");
    if (user.role === "admin") throw new Error("Не можна видалити адміністратора");
    // Allow deletion of students and teachers
    if (user.role !== "student" && user.role !== "teacher") throw new Error("Можна видаляти лише учнів або вчителів");

    (user as any).isArchived = true;
    (user as any).archivedAt = new Date();
    await user.save();
    return user as IUser;
  }

  async restoreUser(userId: string): Promise<IUser> {
    const user = await userModel.findById(userId);
    if (!user) throw new Error("Користувача не знайдено");

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
      throw new Error("Учня не знайдено");
    }

    if (requester.role === "admin") {
      return { roleScope: "all", teacherSubjectIds: [] };
    }

    if (requester.role === "student") {
      if (requester.id !== student.id) {
        throw new Error("Заборонено");
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
        throw new Error("Заборонено");
      }

      return { roleScope: "teacher-subjects", teacherSubjectIds };
    }

    throw new Error("Заборонено");
  }

  async getStudentPerformance(
    requesterId: string,
    studentId: string,
    subjectId?: string
  ): Promise<IPerformancePoint[]> {
    const requester = await this.getUserById(requesterId);
    if (!requester) {
      throw new Error("Неавторизовано");
    }

    const student = await this.getUserById(studentId);
    if (!student) {
      throw new Error("Учня не знайдено");
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
          throw new Error("Заборонено");
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
      throw new Error("Заборонено");
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