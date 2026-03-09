/// <reference types="vitest" />
import { describe, it, expect, beforeEach, vi } from "vitest";
import mongoose from "mongoose";

// Mocks
const subjectModelMock: any = { findById: vi.fn(), findOne: vi.fn() };
const userModelMock: any = { find: vi.fn() };
const journalModelMock: any = { findOne: vi.fn(), create: vi.fn(), find: vi.fn(), findById: vi.fn(), findByIdAndDelete: vi.fn() };
const gradeModelMock: any = { findById: vi.fn() };

vi.mock("../subject/subject-model", () => ({ default: subjectModelMock }));
vi.mock("../user/user-model", () => ({ default: userModelMock }));
vi.mock("../journal/journal-model", () => ({ default: journalModelMock }));
vi.mock("../grade/grade-model", () => ({ GradeModel: gradeModelMock }));

// Helper to import fresh module after mocks are configured
const loadService = async () => {
  const mod = await import("../journal/journal-service");
  return mod.default;
};

describe("JournalService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates journal for class when none exists and pre-fills students", async () => {
    const subjectId = new mongoose.Types.ObjectId().toString();
    const classId = new mongoose.Types.ObjectId().toString();
    subjectModelMock.findById.mockResolvedValueOnce({ _id: subjectId, name: "Math" });
    gradeModelMock.findById.mockResolvedValueOnce({ _id: classId, grade: 3 });
    journalModelMock.findOne.mockResolvedValueOnce(null);

    const students = [
      { _id: new mongoose.Types.ObjectId(), name: "Ann", email: "ann@example.com", grade: 3 },
      { _id: new mongoose.Types.ObjectId(), name: "Bob", email: "bob@example.com", grade: 3 },
    ];
    userModelMock.find.mockReturnValueOnce({ select: vi.fn().mockResolvedValue(students) });

    const populatedDoc = {
      _id: new mongoose.Types.ObjectId(),
      grade: 3,
      createdAt: new Date("2024-01-01"),
      entries: students.map((s) => ({
        student: { _id: s._id, name: s.name, email: s.email, grade: s.grade },
        mark: null,
      })),
    };

    const mockPopulate = vi.fn().mockResolvedValue(populatedDoc);
    journalModelMock.create.mockResolvedValueOnce({ populate: mockPopulate });

    const service = await loadService();
    const result = await service.createJournal(subjectId, classId);

    expect(journalModelMock.findOne).toHaveBeenCalledWith(expect.objectContaining({ subject: expect.anything() }));
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].student.name).toBe("Ann");
  });

  it("throws if journal already exists for class", async () => {
    const subjectId = new mongoose.Types.ObjectId().toString();
    const classId = new mongoose.Types.ObjectId().toString();
    subjectModelMock.findById.mockResolvedValueOnce({ _id: subjectId });
    gradeModelMock.findById.mockResolvedValueOnce({ _id: classId, grade: 3 });
    journalModelMock.findOne.mockResolvedValueOnce({ _id: "existing" });

    const service = await loadService();
    await expect(service.createJournal(subjectId, classId)).rejects.toThrow("Journal already exists for this grade and subject");
  });

  it("returns journals with mapped entries", async () => {
    const subjectId = new mongoose.Types.ObjectId().toString();
    const journals = [
      {
        _id: new mongoose.Types.ObjectId(),
        grade: 2,
        createdAt: new Date("2024-01-02"),
        entries: [
          { student: { _id: "stu1", name: "Kid", email: "kid@example.com", grade: 2 }, mark: 11 },
        ],
      },
    ];

    const sortMock = vi.fn().mockResolvedValue(journals);
    const populateMock = vi.fn().mockReturnValue({ sort: sortMock });
    journalModelMock.find.mockReturnValue({ populate: populateMock });

    const service = await loadService();
    const res = await service.getJournalsForSubject(subjectId);

    expect(journalModelMock.find).toHaveBeenCalledWith({ subject: expect.anything() });
    expect(populateMock).toHaveBeenCalled();
    expect(sortMock).toHaveBeenCalledWith({ grade: 1 });
    expect(res[0].entries[0].mark).toBe(11);
  });

  it("updates lesson mark for student", async () => {
    const journalId = new mongoose.Types.ObjectId().toString();
    const studentId = new mongoose.Types.ObjectId().toString();
    const lessonId = new mongoose.Types.ObjectId().toString();

    const journal = {
      _id: journalId,
      subject: { _id: "sub1", teacher: "teach1" },
      grade: 5,
      lessons: [
        {
          _id: lessonId,
          topic: "Algebra",
          date: new Date(),
          marks: [{ student: studentId, mark: 8 }],
        },
      ],
      save: vi.fn(),
    };

    const journalWithPopulate = {
      ...journal,
      populate: vi.fn().mockResolvedValue({
        ...journal,
        lessons: [
          {
            _id: lessonId,
            topic: "Algebra",
            date: journal.lessons[0].date,
            marks: [{ student: { _id: studentId, name: "John", email: "john@example.com" }, mark: 10 }],
          },
        ],
      }),
    };

    journalModelMock.findById.mockReturnValue({ populate: vi.fn().mockResolvedValue(journalWithPopulate) });

    const service = await loadService();
    const user = { id: "teach1", role: "teacher" };

    // Update mark from 8 to 10
    journal.lessons[0].marks[0].mark = 10;
    const result = await service.updateLessonMark(journalId, lessonId, studentId, 10, user);

    expect(journal.save).toHaveBeenCalled();
    expect(result.marks[0].mark).toBe(10);
    expect(result.topic).toBe("Algebra");
  });

  it("throws Forbidden when non-owner teacher tries to update mark", async () => {
    const journalId = new mongoose.Types.ObjectId().toString();
    const studentId = new mongoose.Types.ObjectId().toString();
    const lessonId = new mongoose.Types.ObjectId().toString();

    const journal = {
      _id: journalId,
      subject: { _id: "sub1", teacher: "teach1" },
      grade: 5,
      lessons: [],
      save: vi.fn(),
    };

    const populateMock = vi.fn().mockResolvedValue(journal);
    journalModelMock.findById.mockReturnValue({ populate: populateMock });

    const service = await loadService();
    const otherTeacher = { id: "teach2", role: "teacher" };

    await expect(service.updateLessonMark(journalId, lessonId, studentId, 10, otherTeacher)).rejects.toThrow(
      "Forbidden"
    );
  });

  it("adds lesson to journal", async () => {
    const journalId = new mongoose.Types.ObjectId().toString();
    const student1Id = new mongoose.Types.ObjectId().toString();
    const student2Id = new mongoose.Types.ObjectId().toString();

    const lessonsArray: any[] = [];

    const journal = {
      _id: journalId,
      subject: { _id: "sub1", teacher: "teach1" },
      grade: 3,
      lessons: lessonsArray,
      save: vi.fn(),
      populate: vi.fn(),
    };

    const mockPopulateFn = vi.fn().mockResolvedValue({
      ...journal,
      lessons: [
        {
          _id: new mongoose.Types.ObjectId(),
          topic: "Introduction to Fractions",
          date: expect.any(Date),
          marks: [
            {
              student: { _id: student1Id, name: "Alice", email: "alice@example.com", grade: 3 },
              mark: 9,
            },
            {
              student: { _id: student2Id, name: "Bob", email: "bob@example.com", grade: 3 },
              mark: null,
            },
          ],
        },
      ],
    });

    journal.populate.mockReturnValue(mockPopulateFn);
    journalModelMock.findById.mockReturnValue({
      populate: vi.fn().mockResolvedValue(journal),
    });

    const service = await loadService();
    const teacher = { id: "teach1", role: "teacher" };

    const newLesson = await service.addLesson(
      journalId,
      "Introduction to Fractions",
      [
        { studentId: student1Id, mark: 9 },
        { studentId: student2Id, mark: null },
      ],
      teacher
    );

    expect(journal.save).toHaveBeenCalled();
    expect(newLesson.topic).toBe("Introduction to Fractions");
    expect(newLesson.marks).toHaveLength(2);
  });

  it("throws Forbidden when non-owner teacher adds lesson", async () => {
    const journalId = new mongoose.Types.ObjectId().toString();
    const student1Id = new mongoose.Types.ObjectId().toString();

    const journal = {
      _id: journalId,
      subject: { _id: "sub1", teacher: "teach1" },
      grade: 3,
      lessons: [],
      save: vi.fn(),
      populate: vi.fn(),
    };

    journalModelMock.findById.mockReturnValue({
      populate: vi.fn().mockResolvedValue(journal),
    });

    const service = await loadService();
    const otherTeacher = { id: "teach2", role: "teacher" };

    await expect(
      service.addLesson(journalId, "Some Topic", [{ studentId: student1Id, mark: 5 }], otherTeacher)
    ).rejects.toThrow("Forbidden");
  });

  it("throws error if lesson topic is empty", async () => {
    const journalId = new mongoose.Types.ObjectId().toString();
    const student1Id = new mongoose.Types.ObjectId().toString();

    const service = await loadService();

    await expect(service.addLesson(journalId, "  ", [{ studentId: student1Id, mark: 5 }])).rejects.toThrow(
      "Lesson topic is required"
    );
  });

  it("syncs journal with new students in grade", async () => {
    const journalId = new mongoose.Types.ObjectId().toString();
    const existingStudentId = new mongoose.Types.ObjectId().toString();
    const newStudentId = new mongoose.Types.ObjectId().toString();

    const journal = {
      _id: journalId,
      grade: 4,
      entries: [
        {
          student: new mongoose.Types.ObjectId(existingStudentId),
          mark: null,
        },
      ],
      save: vi.fn(),
      populate: vi.fn(),
    };

    const students = [
      { _id: new mongoose.Types.ObjectId(existingStudentId) },
      { _id: new mongoose.Types.ObjectId(newStudentId) },
    ];

    journalModelMock.findById.mockResolvedValueOnce(journal);
    userModelMock.find.mockReturnValue({ select: vi.fn().mockResolvedValue(students) });

    const mockPopulated = {
      ...journal,
      entries: [
        {
          student: { _id: existingStudentId, name: "Alice", email: "alice@example.com", grade: 4 },
          mark: null,
        },
        {
          student: { _id: newStudentId, name: "Carol", email: "carol@example.com", grade: 4 },
          mark: null,
        },
      ],
    };

    journal.populate.mockResolvedValue(mockPopulated);

    const service = await loadService();
    const result = await service.syncJournalStudents(journalId);

    expect(journal.save).toHaveBeenCalled();
    expect(result.entries).toHaveLength(2);
    expect(result.entries[1].student.name).toBe("Carol");
  });

  it("removes archived students from journal sync", async () => {
    const journalId = new mongoose.Types.ObjectId().toString();
    const activeStudentId = new mongoose.Types.ObjectId().toString();

    const journal = {
      _id: journalId,
      grade: 5,
      entries: [
        {
          student: new mongoose.Types.ObjectId(activeStudentId),
          mark: null,
        },
      ],
      save: vi.fn(),
      populate: vi.fn(),
    };

    const students = [{ _id: new mongoose.Types.ObjectId(activeStudentId) }];

    journalModelMock.findById.mockResolvedValueOnce(journal);
    userModelMock.find.mockReturnValue({ select: vi.fn().mockResolvedValue(students) });

    const mockPopulated = {
      ...journal,
      entries: [
        {
          student: {
            _id: activeStudentId,
            name: "Alice",
            email: "alice@example.com",
            grade: 5,
            isArchived: false,
          },
          mark: null,
        },
      ],
    };

    journal.populate.mockResolvedValue(mockPopulated);

    const service = await loadService();
    const result = await service.syncJournalStudents(journalId);

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].student.isArchived).toBe(false);
  });

  it("deletes journal", async () => {
    const journalId = new mongoose.Types.ObjectId().toString();

    const journal = {
      _id: journalId,
      grade: 6,
    };

    journalModelMock.findById.mockReturnValue({ populate: vi.fn().mockResolvedValue(journal) });
    journalModelMock.findByIdAndDelete.mockResolvedValueOnce(journal);

    const service = await loadService();
    await service.deleteJournal(journalId, { id: "admin1", role: "admin" });

    expect(journalModelMock.findById).toHaveBeenCalledWith(journalId);
    expect(journalModelMock.findByIdAndDelete).toHaveBeenCalledWith(journalId);
  });

  it("throws error if trying to delete non-existent journal", async () => {
    const journalId = new mongoose.Types.ObjectId().toString();

    journalModelMock.findById.mockReturnValue({ populate: vi.fn().mockResolvedValue(null) });

    const service = await loadService();
    await expect(service.deleteJournal(journalId, { id: "admin1", role: "admin" })).rejects.toThrow("Journal not found");
  });

  it("throws Forbidden when non-owner teacher tries to delete journal", async () => {
    const journalId = new mongoose.Types.ObjectId().toString();

    const journal = {
      _id: journalId,
      subject: { _id: "sub1", teacher: "teach1" },
      grade: 6,
    };

    journalModelMock.findById.mockReturnValue({ populate: vi.fn().mockResolvedValue(journal) });

    const service = await loadService();
    await expect(service.deleteJournal(journalId, { id: "teach2", role: "teacher" })).rejects.toThrow("Forbidden");
  });
});
