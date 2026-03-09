import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import userModel from "../src/user/user-model";
import subjectModel from "../src/subject/subject-model";
import journalModel from "../src/journal/journal-model";
import attendanceModel from "../src/attendance/attendance-model";
import { GradeModel } from "../src/grade/grade-model";

interface SeedUser {
  name: string;
  email: string;
  role: "admin" | "teacher" | "student";
  grade?: number;
}

interface SeedLesson {
  topic: string;
  date: string;
  absentEmails?: string[];
}

interface SeedJournalPlan {
  subjectName: string;
  grade: number;
  lessons: SeedLesson[];
}

async function ensureUser(user: SeedUser, password: string) {
  const passwordHash = await bcrypt.hash(password, 10);
  const update: any = {
    name: user.name,
    role: user.role,
    password: passwordHash,
    isArchived: false,
    archivedAt: null,
  };

  if (typeof user.grade === "number") {
    update.grade = user.grade;
  } else {
    update.$unset = { grade: "" };
  }

  return userModel.findOneAndUpdate({ email: user.email }, update, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  });
}

async function main() {
  const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/school_app";
  await mongoose.connect(mongoUri);

  const defaultPassword = "school321";

  const admin = await ensureUser(
    {
      name: "Адміністратор школи",
      email: "admin",
      role: "admin",
    },
    defaultPassword
  );

  const teachers = await Promise.all([
    ensureUser({ name: "Олена Іваненко", email: "olena.ivanenko@school.local", role: "teacher" }, defaultPassword),
    ensureUser({ name: "Петро Коваль", email: "petro.koval@school.local", role: "teacher" }, defaultPassword),
    ensureUser({ name: "Наталія Шевченко", email: "nataliia.shevchenko@school.local", role: "teacher" }, defaultPassword),
    ensureUser({ name: "Ігор Мельник", email: "ihor.melnyk@school.local", role: "teacher" }, defaultPassword),
  ]);

  const grade5Students = await Promise.all([
    ensureUser({ name: "Андрій Бондар", email: "andrii.bondar@school.local", role: "student", grade: 5 }, defaultPassword),
    ensureUser({ name: "Марія Гнатюк", email: "mariia.hnatiuk@school.local", role: "student", grade: 5 }, defaultPassword),
    ensureUser({ name: "Софія Ткачук", email: "sofiia.tkachuk@school.local", role: "student", grade: 5 }, defaultPassword),
  ]);

  const grade6Students = await Promise.all([
    ensureUser({ name: "Денис Кравець", email: "denys.kravets@school.local", role: "student", grade: 6 }, defaultPassword),
    ensureUser({ name: "Ірина Савчук", email: "iryna.savchuk@school.local", role: "student", grade: 6 }, defaultPassword),
    ensureUser({ name: "Максим Литвин", email: "maksym.lytvyn@school.local", role: "student", grade: 6 }, defaultPassword),
  ]);

  const grade5 = await GradeModel.findOneAndUpdate(
    { grade: 5 },
    { grade: 5, formTeacher: teachers[0]._id },
    { new: true, upsert: true }
  );

  const grade6 = await GradeModel.findOneAndUpdate(
    { grade: 6 },
    { grade: 6, formTeacher: teachers[1]._id },
    { new: true, upsert: true }
  );

  const subjects = {
    math: await subjectModel.findOneAndUpdate(
      { name: "Математика" },
      { name: "Математика", teacher: teachers[0]._id },
      { new: true, upsert: true }
    ),
    ukrainian: await subjectModel.findOneAndUpdate(
      { name: "Українська мова" },
      { name: "Українська мова", teacher: teachers[2]._id },
      { new: true, upsert: true }
    ),
    history: await subjectModel.findOneAndUpdate(
      { name: "Історія України" },
      { name: "Історія України", teacher: teachers[1]._id },
      { new: true, upsert: true }
    ),
    biology: await subjectModel.findOneAndUpdate(
      { name: "Біологія" },
      { name: "Біологія", teacher: teachers[3]._id },
      { new: true, upsert: true }
    ),
  };

  const studentsByGrade: Record<number, any[]> = {
    5: grade5Students,
    6: grade6Students,
  };

  const plans: SeedJournalPlan[] = [
    {
      subjectName: "Математика",
      grade: 5,
      lessons: [
        { topic: "Ділення багатоцифрових чисел", date: "2026-02-03", absentEmails: ["mariia.hnatiuk@school.local"] },
        { topic: "Розв'язування задач на відсотки", date: "2026-02-10", absentEmails: ["sofiia.tkachuk@school.local"] },
        { topic: "Периметр та площа прямокутника", date: "2026-02-17" },
      ],
    },
    {
      subjectName: "Українська мова",
      grade: 5,
      lessons: [
        { topic: "Речення з однорідними членами", date: "2026-02-05", absentEmails: ["andrii.bondar@school.local"] },
        { topic: "Апостроф та м'який знак", date: "2026-02-12" },
        { topic: "Текст-опис. Побудова висловлювання", date: "2026-02-19", absentEmails: ["mariia.hnatiuk@school.local"] },
      ],
    },
    {
      subjectName: "Історія України",
      grade: 6,
      lessons: [
        { topic: "Київська Русь: становлення держави", date: "2026-02-04", absentEmails: ["denys.kravets@school.local"] },
        { topic: "Культура та писемність Русі", date: "2026-02-11" },
        { topic: "Галицько-Волинська держава", date: "2026-02-18", absentEmails: ["iryna.savchuk@school.local"] },
      ],
    },
    {
      subjectName: "Біологія",
      grade: 6,
      lessons: [
        { topic: "Клітина як одиниця живого", date: "2026-02-06" },
        { topic: "Тканини рослинного організму", date: "2026-02-13", absentEmails: ["maksym.lytvyn@school.local"] },
        { topic: "Фотосинтез та його значення", date: "2026-02-20", absentEmails: ["denys.kravets@school.local"] },
      ],
    },
  ];

  const subjectByName: Record<string, any> = {
    "Математика": subjects.math,
    "Українська мова": subjects.ukrainian,
    "Історія України": subjects.history,
    "Біологія": subjects.biology,
  };

  const attendanceByClassAndDate = new Map<string, Set<string>>();

  for (const plan of plans) {
    const subject = subjectByName[plan.subjectName];
    if (!subject) continue;

    const classStudents = studentsByGrade[plan.grade] || [];
    const studentIds = classStudents.map((s) => s._id.toString());

    const lessonDocs = plan.lessons.map((lesson) => {
      const absentSet = new Set(lesson.absentEmails || []);
      const marks = classStudents.map((student) => {
        const isAbsent = absentSet.has(student.email);
        const markValue = isAbsent ? null : 7 + Math.floor(Math.random() * 6);
        return {
          student: student._id,
          mark: markValue,
        };
      });

      const attendanceKey = `${plan.grade}::${lesson.date}`;
      const existingAbsentees = attendanceByClassAndDate.get(attendanceKey) || new Set<string>();
      for (const absentEmail of lesson.absentEmails || []) {
        const absentStudent = classStudents.find((s) => s.email === absentEmail);
        if (absentStudent) {
          existingAbsentees.add(absentStudent._id.toString());
        }
      }
      attendanceByClassAndDate.set(attendanceKey, existingAbsentees);

      return {
        topic: lesson.topic,
        date: new Date(`${lesson.date}T08:00:00.000Z`),
        marks,
      };
    });

    await journalModel.findOneAndUpdate(
      { subject: subject._id, grade: plan.grade },
      {
        subject: subject._id,
        grade: plan.grade,
        entries: studentIds.map((studentId) => ({ student: studentId, mark: null })),
        lessons: lessonDocs,
      },
      { new: true, upsert: true }
    );
  }

  const gradeByNumber: Record<number, any> = {
    5: grade5,
    6: grade6,
  };

  for (const [key, absentSet] of attendanceByClassAndDate.entries()) {
    const [gradeText, dateText] = key.split("::");
    const grade = Number(gradeText);
    const gradeDoc = gradeByNumber[grade];
    const classStudents = studentsByGrade[grade] || [];

    const entries = classStudents.map((student) => ({
      student: student._id,
      present: !absentSet.has(student._id.toString()),
    }));

    await attendanceModel.findOneAndUpdate(
      { class: gradeDoc._id, date: new Date(`${dateText}T00:00:00.000Z`) },
      {
        class: gradeDoc._id,
        date: new Date(`${dateText}T00:00:00.000Z`),
        entries,
      },
      { new: true, upsert: true }
    );
  }

  console.log("Seed complete");
  console.log(`Admin: ${admin.email} / password: ${defaultPassword}`);
  console.log("Teachers:", teachers.map((t) => t.email).join(", "));
  console.log("Students grade 5:", grade5Students.map((s) => s.email).join(", "));
  console.log("Students grade 6:", grade6Students.map((s) => s.email).join(", "));

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Seed failed:", error);
  await mongoose.disconnect();
  process.exit(1);
});
