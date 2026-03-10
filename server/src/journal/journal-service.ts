import mongoose from "mongoose";
import journalModel from "./journal-model";
import subjectModel from "../subject/subject-model";
import userModel from "../user/user-model";
import { GradeModel } from "../grade/grade-model";
import attendanceModel from "../attendance/attendance-model";
import { IJournalResponse, ILessonResponse } from "../types/journal.types";

export default new class JournalService {
  private getDateRange(date: Date): { start: Date; end: Date } {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }

  private async getAbsentStudentIds(grade: number, date: Date): Promise<Set<string>> {
    try {
      const gradeDoc = await GradeModel.findOne({ grade }).select("_id");
      if (!gradeDoc) {
        return new Set<string>();
      }

      const { start, end } = this.getDateRange(date);
      const attendanceRecord = await (attendanceModel as any)
        .findOne({
          class: gradeDoc._id,
          date: { $gte: start, $lt: end },
        })
        .select("entries.student entries.present");

      if (!attendanceRecord) {
        return new Set<string>();
      }

      const absentIds = (attendanceRecord.entries || [])
        .filter((entry: any) => entry.present === false)
        .map((entry: any) => entry.student?.toString())
        .filter(Boolean);

      return new Set<string>(absentIds);
    } catch {
      return new Set<string>();
    }
  }

  async deleteJournal(
    journalId: string,
    user?: { id: string; role?: string } | null
  ): Promise<void> {
    const journal = await journalModel.findById(journalId).populate({ path: "subject" });
    if (!journal) {
      throw new Error("Журнал не знайдено");
    }

    if (user?.role === "teacher") {
      const subjectTeacherId = (journal.subject as any)?.teacher?.toString();
      if (subjectTeacherId && subjectTeacherId !== user.id) {
        throw new Error("Заборонено");
      }
    }

    await journalModel.findByIdAndDelete(journalId);
  }

  async syncJournalStudents(journalId: string): Promise<IJournalResponse> {
    const journal = await journalModel.findById(journalId);
    if (!journal) {
      throw new Error("Журнал не знайдено");
    }

    const grade = (journal as any).grade;
    if (grade === undefined || grade === null) {
      throw new Error("Для журналу не знайдено клас");
    }

    const students = await userModel.find({ role: "student", grade: grade, isArchived: { $ne: true } }).select("_id");
    const studentIds = students.map((s) => s._id.toString());

    const existingStudentIds = new Set(journal.entries.map((e: any) => e.student.toString()));
    const newStudentIds = studentIds.filter((id) => !existingStudentIds.has(id));
    if (newStudentIds.length > 0) {
      const newEntries = newStudentIds.map((id) => ({ student: new mongoose.Types.ObjectId(id), mark: null }));
      journal.entries.push(...newEntries as any);
      await journal.save();
    }

    const populated: any = await journal.populate({ path: "entries.student lessons.marks.student", select: "name email grade isArchived archivedAt birthdate dateOfBirth" });
    return await this.mapJournal(populated);
  }

  async createJournal(subjectId: string, classId: string): Promise<IJournalResponse> {
    const subject = await subjectModel.findById(subjectId);
    if (!subject) throw new Error("Предмет не знайдено");

    const classDoc = await GradeModel.findById(classId);
    if (!classDoc) throw new Error("Клас не знайдено");

    const subjectObjId = new mongoose.Types.ObjectId(subjectId);
    const grade = classDoc.grade;
    
    const exists = await journalModel.findOne({ subject: subjectObjId as any, grade } as any);
    if (exists) throw new Error("Журнал для цього класу та предмета вже існує");

    console.log("[Journal] Creating journal for grade:", grade);
    const students = await userModel.find({ role: "student", grade: grade, isArchived: { $ne: true } }).select("name email grade");
    console.log("[Journal] Found students:", students.length, students.map((s) => ({ id: s._id, name: s.name, grade: s.grade })));

    const journalDoc = await journalModel.create({
      subject: subjectObjId,
      grade: grade,
      entries: students.map((s) => ({ student: s._id, mark: null })) as any,
    } as any);

    const populated: any = await (journalDoc as any).populate({ path: "entries.student", select: "name email grade isArchived archivedAt birthdate dateOfBirth" });
    return await this.mapJournal(populated);
  }

  async getJournalsForSubject(subjectId: string, includeArchived = false): Promise<IJournalResponse[]> {
    const subjectObjId = new mongoose.Types.ObjectId(subjectId);
    const journals = await journalModel
      .find({ subject: subjectObjId as any })
      .populate({ path: "entries.student lessons.marks.student", select: "name email grade isArchived archivedAt birthdate dateOfBirth" })
      .sort({ grade: 1 });

    console.log("[Journal] Loading journals for subject, found:", journals.length);
    journals.forEach((j, idx) => {
      const grade = (j as any).grade;
      console.log(`[Journal] Journal ${idx} grade=${grade}, entries=${j.entries?.length || 0}`);
      j.entries?.slice(0, 2).forEach((e: any) => {
        console.log("  - Entry student:", e.student ? { id: e.student._id, name: e.student.name, grade: e.student.grade } : `null (raw ID: ${e.student})`);
      });
    });

    const mapped = await Promise.all(journals.map((j) => this.mapJournal(j)));
    if (includeArchived) return mapped;

    return mapped.map((journal) => ({
      ...journal,
      entries: journal.entries.filter((entry) => entry.student.isArchived !== true && !entry.student.archivedAt),
    }));
  }

  async addLesson(
    journalId: string,
    topic: string,
    marks: Array<{ studentId: string; mark?: number | null }>,
    lessonDateOrUser?: string | Date | { id: string; role?: string } | null,
    userMaybe?: { id: string; role?: string } | null
  ): Promise<ILessonResponse> {
    if (!topic?.trim()) {
      throw new Error("Тема уроку є обов'язковою");
    }

    let lessonDate: string | Date | undefined;
    let user: { id: string; role?: string } | null | undefined = userMaybe;

    const looksLikeUserObject =
      !!lessonDateOrUser &&
      typeof lessonDateOrUser === "object" &&
      !(lessonDateOrUser instanceof Date) &&
      ("id" in (lessonDateOrUser as any) || "role" in (lessonDateOrUser as any));

    if (looksLikeUserObject) {
      user = lessonDateOrUser as { id: string; role?: string };
      lessonDate = undefined;
    } else {
      lessonDate = lessonDateOrUser as string | Date | undefined;
    }

    const journal = await journalModel.findById(journalId).populate({ path: "subject" });
    if (!journal) throw new Error("Журнал не знайдено");

    if (user?.role === "teacher") {
      const subjectTeacherId = (journal.subject as any)?.teacher?.toString();
      if (subjectTeacherId && subjectTeacherId !== user.id) {
        throw new Error("Заборонено");
      }
    }

    const normalizedLessonDate = typeof lessonDate === "string" && !lessonDate.trim() ? undefined : lessonDate;
    const parsedLessonDate = normalizedLessonDate ? new Date(normalizedLessonDate) : new Date();
    if (Number.isNaN(parsedLessonDate.getTime())) {
      throw new Error("Невалідна дата уроку");
    }

    const lesson = {
      topic: topic.trim(),
      date: parsedLessonDate,
      marks: (marks || []).map((m) => ({ student: m.studentId, mark: m.mark ?? null })),
    } as any;

    journal.lessons = [...(journal.lessons || []), lesson];
    await journal.save();

    const added = journal.lessons[journal.lessons.length - 1];
    const populated = await journal.populate({ path: "lessons.marks.student", select: "name email grade isArchived archivedAt" });
    const populatedLesson = (populated.lessons || []).find((l: any) => l._id?.toString() === added._id?.toString()) || added;

    return await this.mapLesson(populatedLesson, Number((journal as any).grade));
  }

  async deleteLesson(
    journalId: string,
    lessonId: string,
    user?: { id: string; role?: string } | null
  ): Promise<void> {
    const journal = await journalModel.findById(journalId).populate({ path: "subject" });
    if (!journal) throw new Error("Журнал не знайдено");

    if (user?.role === "teacher") {
      const subjectTeacherId = (journal.subject as any)?.teacher?.toString();
      if (subjectTeacherId && subjectTeacherId !== user.id) {
        throw new Error("Заборонено");
      }
    }

    const beforeCount = (journal.lessons || []).length;
    journal.lessons = (journal.lessons || []).filter(
      (lesson: any) => lesson._id?.toString() !== lessonId
    ) as any;

    if ((journal.lessons || []).length === beforeCount) {
      throw new Error("Урок не знайдено");
    }

    await journal.save();
  }

  async updateLessonMark(
    journalId: string,
    lessonId: string,
    studentId: string,
    mark: number | null,
    user?: { id: string; role?: string } | null
  ): Promise<ILessonResponse> {
    const journal = await journalModel.findById(journalId).populate({ path: "subject" });
    if (!journal) throw new Error("Журнал не знайдено");

    if (user?.role === "teacher") {
      const subjectTeacherId = (journal.subject as any)?.teacher?.toString();
      if (subjectTeacherId && subjectTeacherId !== user.id) {
        throw new Error("Заборонено");
      }
    }

    const lessonIndex = (journal.lessons || []).findIndex((l: any) => l._id?.toString() === lessonId);
    if (lessonIndex === -1) throw new Error("Урок не знайдено");

    const lesson = journal.lessons![lessonIndex];
    const markIndex = (lesson.marks || []).findIndex((m: any) => m.student.toString() === studentId);
    if (markIndex === -1) throw new Error("Запис оцінки учня в уроці не знайдено");

    const journalGrade = Number((journal as any).grade);
    const lessonDate = new Date((lesson as any).date || new Date());
    const absentIds = await this.getAbsentStudentIds(journalGrade, lessonDate);
    if (absentIds.has(studentId)) {
      throw new Error("Неможливо виставити оцінку: учень відсутній на цю дату");
    }

    lesson.marks![markIndex].mark = mark;
    await journal.save();

    const populated = await journal.populate({ path: "lessons.marks.student", select: "name email grade isArchived archivedAt" });
    const populatedLesson = (populated.lessons || [])[lessonIndex];

    return await this.mapLesson(populatedLesson, journalGrade);
  }

  async updateLessonTopic(
    journalId: string,
    lessonId: string,
    topic?: string,
    date?: string | Date,
    user?: { id: string; role?: string } | null
  ): Promise<ILessonResponse> {
    if (topic === undefined && date === undefined) {
      throw new Error("Передайте тему або дату уроку");
    }

    if (topic !== undefined && !topic.trim()) {
      throw new Error("Тема уроку є обов'язковою");
    }

    const journal = await journalModel.findById(journalId).populate({ path: "subject" });
    if (!journal) throw new Error("Журнал не знайдено");

    if (user?.role === "teacher") {
      const subjectTeacherId = (journal.subject as any)?.teacher?.toString();
      if (subjectTeacherId && subjectTeacherId !== user.id) {
        throw new Error("Заборонено");
      }
    }

    const lessonIndex = (journal.lessons || []).findIndex((l: any) => l._id?.toString() === lessonId);
    if (lessonIndex === -1) throw new Error("Урок не знайдено");

    if (topic !== undefined) {
      journal.lessons![lessonIndex].topic = topic.trim();
    }

    if (date !== undefined) {
      const parsedLessonDate = new Date(date);
      if (Number.isNaN(parsedLessonDate.getTime())) {
        throw new Error("Невалідна дата уроку");
      }
      journal.lessons![lessonIndex].date = parsedLessonDate;
    }

    await journal.save();

    const journalGrade = Number((journal as any).grade);
    const populated = await journal.populate({ path: "lessons.marks.student", select: "name email grade isArchived archivedAt" });
    const populatedLesson = (populated.lessons || [])[lessonIndex];

    return await this.mapLesson(populatedLesson, journalGrade);
  }

  private async mapJournal(journal: any): Promise<IJournalResponse> {
    const classDoc = journal.class as any;
    const grade = classDoc?.grade ?? journal.grade ?? 0;
    const lessons = await Promise.all((journal.lessons || []).map((lesson: any) => this.mapLesson(lesson, grade)));
    
    return {
      id: journal._id?.toString() || "",
      grade,
      createdAt: journal.createdAt || new Date(),
      entries: (journal.entries || []).map((e: any) => ({
        student: {
          id: e.student?._id?.toString() || "",
          name: e.student?.name,
          email: e.student?.email,
          birthdate: e.student?.birthdate || e.student?.dateOfBirth,
          grade: e.student?.grade,
          isArchived: e.student?.isArchived,
          archivedAt: e.student?.archivedAt,
          isTransferred: e.student?.grade !== undefined && e.student?.grade !== null && e.student.grade !== grade,
        },
        mark: e.mark ?? null,
      })),
      lessons,
    };
  }

  private async mapLesson(lesson: any, journalGrade?: number): Promise<ILessonResponse> {
    const lessonDate = new Date(lesson.date || new Date());
    const absentIds = journalGrade !== undefined
      ? await this.getAbsentStudentIds(journalGrade, lessonDate)
      : new Set<string>();

    return {
      id: lesson._id?.toString() || "",
      topic: lesson.topic,
      date: lessonDate,
      marks: (lesson.marks || []).map((m: any) => ({
        student: {
          id: m.student?._id?.toString() || "",
          name: m.student?.name,
          email: m.student?.email,
          birthdate: m.student?.birthdate || m.student?.dateOfBirth,
          grade: m.student?.grade,
          isArchived: m.student?.isArchived,
          archivedAt: m.student?.archivedAt,
          isTransferred: journalGrade !== undefined && m.student?.grade !== undefined && m.student?.grade !== null && m.student.grade !== journalGrade,
        },
        mark: m.mark ?? null,
        isAbsent: absentIds.has(m.student?._id?.toString() || ""),
      })),
    };
  }
}();
