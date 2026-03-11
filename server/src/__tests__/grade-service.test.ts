/// <reference types="vitest" />
import { describe, it, expect, beforeEach, vi } from "vitest";
import mongoose from "mongoose";

// Mocks
const gradeModelMock: any = { find: vi.fn(), findOne: vi.fn(), create: vi.fn() };
const userModelMock: any = { countDocuments: vi.fn(), find: vi.fn(), findById: vi.fn() };

vi.mock("../grade/grade-model", () => ({ GradeModel: gradeModelMock }));
vi.mock("../user/user-model", () => ({ default: userModelMock }));

// Helper to import fresh module
const loadService = async () => {
  const mod = await import("../grade/grade-service");
  return mod.GradeService;
};

describe("GradeService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches all grades with student counts", async () => {
    const grades = [
      {
        _id: new mongoose.Types.ObjectId(),
        grade: 1,
        formTeacher: { _id: "teach1", name: "Mr. Smith", email: "smith@example.com" },
        createdAt: new Date("2024-01-01"),
      },
      {
        _id: new mongoose.Types.ObjectId(),
        grade: 2,
        formTeacher: null,
        createdAt: new Date("2024-01-01"),
      },
    ];

    const sortMock = vi.fn().mockResolvedValue(grades);
    const populateMock = vi.fn().mockReturnValue({ sort: sortMock });
    gradeModelMock.find.mockReturnValue({ populate: populateMock });

    userModelMock.countDocuments.mockResolvedValueOnce(25); // 25 students in grade 1
    userModelMock.countDocuments.mockResolvedValueOnce(30); // 30 students in grade 2

    const service = await loadService();
    const result = await service.getAllGrades();

    expect(gradeModelMock.find).toHaveBeenCalled();
    expect(populateMock).toHaveBeenCalledWith("formTeacher", "name email");
    expect(result).toHaveLength(2);
    expect(result[0].grade).toBe(1);
    expect(result[0].studentCount).toBe(25);
    expect(result[0].formTeacher?.name).toBe("Mr. Smith");
    expect(result[1].formTeacher).toBeUndefined();
  });

  it("fetches single grade with students list", async () => {
    const grade = {
      _id: new mongoose.Types.ObjectId(),
      grade: 3,
      formTeacher: { _id: "teach1", name: "Ms. Johnson", email: "johnson@example.com" },
      createdAt: new Date("2024-01-01"),
    };

    const students = [
      { _id: new mongoose.Types.ObjectId(), name: "Alice", email: "alice@example.com", isArchived: false },
      { _id: new mongoose.Types.ObjectId(), name: "Bob", email: "bob@example.com", isArchived: false },
    ];

    const selectMock = vi.fn().mockResolvedValue(students);
    gradeModelMock.findOne.mockReturnValueOnce({ populate: vi.fn().mockResolvedValue(grade) });
    userModelMock.find.mockReturnValue({ select: selectMock });

    const service = await loadService();
    const result = await service.getGrade(3);

    expect(gradeModelMock.findOne).toHaveBeenCalledWith({ grade: 3 });
    expect(userModelMock.find).toHaveBeenCalledWith({ grade: 3, role: "student", isArchived: { $ne: true } });
    expect(result?.studentCount).toBe(2);
    expect(result?.students).toHaveLength(2);
    expect(result?.students[0].name).toBe("Alice");
  });

  it("sets form teacher for grade", async () => {
    const gradeNumber = 4;
    const teacherId = new mongoose.Types.ObjectId().toString();

    const teacher = {
      _id: teacherId,
      role: "teacher",
      isArchived: false,
      name: "Mr. Wilson",
    };

    const grade = {
      _id: new mongoose.Types.ObjectId(),
      grade: gradeNumber,
      formTeacher: null,
      save: vi.fn(),
    };

    userModelMock.findById.mockResolvedValueOnce(teacher);
    gradeModelMock.findOne.mockResolvedValueOnce(grade);

    const service = await loadService();
    await service.setFormTeacher(gradeNumber, teacherId);

    expect(userModelMock.findById).toHaveBeenCalledWith(teacherId);
    expect(gradeModelMock.findOne).toHaveBeenCalledWith({ grade: gradeNumber });
    expect(grade.save).toHaveBeenCalled();
  });

  it("throws error if teacher is not valid", async () => {
    const gradeNumber = 5;
    const userId = new mongoose.Types.ObjectId().toString();

    const student = {
      _id: userId,
      role: "student",
      isArchived: false,
    };

    userModelMock.findById.mockResolvedValueOnce(student);

    const service = await loadService();
    await expect(service.setFormTeacher(gradeNumber, userId)).rejects.toThrow("Невалідний вчитель");
  });

  it("throws error if teacher is archived", async () => {
    const gradeNumber = 6;
    const teacherId = new mongoose.Types.ObjectId().toString();

    const teacher = {
      _id: teacherId,
      role: "teacher",
      isArchived: true,
      name: "Archived Teacher",
    };

    userModelMock.findById.mockResolvedValueOnce(teacher);

    const service = await loadService();
    await expect(service.setFormTeacher(gradeNumber, teacherId)).rejects.toThrow("Не можна призначити архівного вчителя");
  });

  it("removes form teacher from grade", async () => {
    const gradeNumber = 7;
    const grade = {
      _id: new mongoose.Types.ObjectId(),
      grade: gradeNumber,
      formTeacher: "teach1",
      save: vi.fn(),
    };

    gradeModelMock.findOne.mockResolvedValueOnce(grade);

    const service = await loadService();
    await service.removeFormTeacher(gradeNumber);

    expect(gradeModelMock.findOne).toHaveBeenCalledWith({ grade: gradeNumber });
    expect(grade.formTeacher).toBeUndefined();
    expect(grade.save).toHaveBeenCalled();
  });

  it("ensures grades 0-8 exist", async () => {
    gradeModelMock.findOne.mockResolvedValue(null);
    gradeModelMock.create.mockResolvedValue({ grade: 0 });

    const service = await loadService();
    await service.ensureGradesExist();

    expect(gradeModelMock.findOne).toHaveBeenCalledTimes(9);
    expect(gradeModelMock.create).toHaveBeenCalledTimes(9);
  });
});
