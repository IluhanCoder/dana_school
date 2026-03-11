/// <reference types="vitest" />
import { describe, it, expect, beforeEach, vi } from "vitest";
import mongoose from "mongoose";

// Mocks
const attendanceModelMock: any = {
  find: vi.fn(),
  findOne: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  findByIdAndDelete: vi.fn(),
};

const userModelMock: any = {
  find: vi.fn(),
};

const gradeModelMock: any = {
  findById: vi.fn(),
};

vi.mock("../attendance/attendance-model", () => ({ default: attendanceModelMock }));
vi.mock("../user/user-model", () => ({ default: userModelMock }));
vi.mock("../grade/grade-model", () => ({ GradeModel: gradeModelMock }));

// Helper to import fresh module
const loadService = async () => {
  const mod = await import("../attendance/attendance-service");
  return mod.default;
};

describe("AttendanceService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches attendance records for a class sorted by date descending", async () => {
    const classId = new mongoose.Types.ObjectId().toString();
    const studentId1 = new mongoose.Types.ObjectId().toString();
    const studentId2 = new mongoose.Types.ObjectId().toString();

    const records = [
      {
        _id: new mongoose.Types.ObjectId(),
        class: classId,
        date: new Date("2024-01-15"),
        entries: [
          {
            student: {
              _id: studentId1,
              name: "Alice",
              email: "alice@example.com",
              isArchived: false,
            },
            present: true,
          },
          {
            student: {
              _id: studentId2,
              name: "Bob",
              email: "bob@example.com",
              isArchived: false,
            },
            present: false,
          },
        ],
        createdAt: new Date("2024-01-15"),
      },
    ];

    const sortMock = vi.fn().mockResolvedValue(records);
    const populateMock = vi.fn().mockReturnValue({ sort: sortMock });
    attendanceModelMock.find.mockReturnValue({ populate: populateMock });

    const service = await loadService();
    const result = await service.getAttendanceForClass(classId);

    expect(attendanceModelMock.find).toHaveBeenCalledWith({ class: classId });
    expect(populateMock).toHaveBeenCalled();
    expect(sortMock).toHaveBeenCalledWith({ date: -1 });
    expect(result).toHaveLength(1);
    expect(result[0].entries).toHaveLength(2);
    expect(result[0].entries[0].student.name).toBe("Alice");
    expect(result[0].entries[0].present).toBe(true);
    expect(result[0].entries[1].present).toBe(false);
  });

  it("adds new attendance record for class", async () => {
    const classId = new mongoose.Types.ObjectId().toString();
    const gradeId = new mongoose.Types.ObjectId();
    const studentId1 = new mongoose.Types.ObjectId();
    const studentId2 = new mongoose.Types.ObjectId();

    const grade = {
      _id: gradeId,
      grade: 1,
    };

    const students = [
      { _id: studentId1, name: "Alice", email: "alice@example.com", grade: 1, role: "student" },
      { _id: studentId2, name: "Bob", email: "bob@example.com", grade: 1, role: "student" },
    ];

    const newRecord = {
      _id: new mongoose.Types.ObjectId(),
      class: classId,
      date: new Date("2024-01-16"),
      entries: [
        {
          student: {
            _id: studentId1,
            name: "Alice",
            email: "alice@example.com",
            isArchived: false,
          },
          present: true,
        },
        {
          student: {
            _id: studentId2,
            name: "Bob",
            email: "bob@example.com",
            isArchived: false,
          },
          present: true,
        },
      ],
      createdAt: new Date("2024-01-16"),
    };

    gradeModelMock.findById.mockResolvedValue(grade);
    attendanceModelMock.findOne.mockResolvedValue(null); // No existing record
    userModelMock.find.mockResolvedValue(students);

    const populateReturnMock = { populate: vi.fn().mockResolvedValue(newRecord) };
    attendanceModelMock.create.mockResolvedValue(populateReturnMock);

    const service = await loadService();
    const result = await service.addAttendanceRecord(classId, new Date("2024-01-16"));

    expect(gradeModelMock.findById).toHaveBeenCalledWith(classId);
    expect(attendanceModelMock.findOne).toHaveBeenCalledWith({
      class: classId,
      date: expect.any(Date),
    });
    expect(userModelMock.find).toHaveBeenCalledWith({
      grade: 1,
      role: "student",
      isArchived: { $ne: true },
    });
    expect(attendanceModelMock.create).toHaveBeenCalled();
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].present).toBe(true);
  });

  it("throws error if grade not found when adding record", async () => {
    const classId = new mongoose.Types.ObjectId().toString();
    
    gradeModelMock.findById.mockResolvedValue(null);

    const service = await loadService();
    await expect(service.addAttendanceRecord(classId, new Date())).rejects.toThrow("Клас не знайдено");
  });

  it("throws error if attendance record already exists for date", async () => {
    const classId = new mongoose.Types.ObjectId().toString();
    const gradeId = new mongoose.Types.ObjectId();

    const grade = {
      _id: gradeId,
      grade: 1,
    };

    const existingRecord = {
      _id: new mongoose.Types.ObjectId(),
      class: classId,
      date: new Date("2024-01-16"),
    };

    gradeModelMock.findById.mockResolvedValue(grade);
    attendanceModelMock.findOne.mockResolvedValue(existingRecord);

    const service = await loadService();
    await expect(service.addAttendanceRecord(classId, new Date("2024-01-16"))).rejects.toThrow(
      "Запис відвідування на цю дату вже існує"
    );
  });

  it("updates student attendance status", async () => {
    const recordId = new mongoose.Types.ObjectId().toString();
    const studentId = new mongoose.Types.ObjectId().toString();

    const updatedRecord = {
      _id: recordId,
      class: new mongoose.Types.ObjectId().toString(),
      date: new Date("2024-01-16"),
      entries: [
        {
          student: {
            _id: studentId,
            name: "Alice",
            email: "alice@example.com",
            isArchived: false,
          },
          present: false,
        },
      ],
      createdAt: new Date("2024-01-16"),
    };

    const record = {
      _id: recordId,
      class: updatedRecord.class,
      date: updatedRecord.date,
      entries: [
        {
          student: new mongoose.Types.ObjectId(studentId),
          present: true,
        },
      ],
      save: vi.fn(),
      populate: vi.fn().mockResolvedValue(updatedRecord),
    };

    attendanceModelMock.findById.mockResolvedValue(record);

    const service = await loadService();
    const result = await service.updateAttendance(recordId, studentId, false);

    expect(attendanceModelMock.findById).toHaveBeenCalledWith(recordId);
    expect(record.save).toHaveBeenCalled();
    expect(result.entries[0].present).toBe(false);
  });

  it("throws error if attendance record not found when updating", async () => {
    const recordId = new mongoose.Types.ObjectId().toString();
    const studentId = new mongoose.Types.ObjectId().toString();

    attendanceModelMock.findById.mockResolvedValue(null);

    const service = await loadService();
    await expect(service.updateAttendance(recordId, studentId, false)).rejects.toThrow(
      "Запис відвідування не знайдено"
    );
  });

  it("throws error if student not in attendance record", async () => {
    const recordId = new mongoose.Types.ObjectId().toString();
    const studentId = new mongoose.Types.ObjectId().toString();
    const otherStudentId = new mongoose.Types.ObjectId().toString();

    const record = {
      _id: recordId,
      class: new mongoose.Types.ObjectId().toString(),
      date: new Date("2024-01-16"),
      entries: [
        {
          student: new mongoose.Types.ObjectId(otherStudentId),
          present: true,
        },
      ],
      save: vi.fn(),
    };

    attendanceModelMock.findById.mockResolvedValue(record);

    const service = await loadService();
    await expect(service.updateAttendance(recordId, studentId, false)).rejects.toThrow(
      "Учня не знайдено в записі відвідування"
    );
  });

  it("deletes attendance record", async () => {
    const recordId = new mongoose.Types.ObjectId().toString();

    const record = {
      _id: recordId,
      class: new mongoose.Types.ObjectId().toString(),
      date: new Date("2024-01-16"),
    };

    attendanceModelMock.findById.mockResolvedValue(record);
    attendanceModelMock.findByIdAndDelete.mockResolvedValue(record);

    const service = await loadService();
    await service.deleteAttendanceRecord(recordId);

    expect(attendanceModelMock.findById).toHaveBeenCalledWith(recordId);
    expect(attendanceModelMock.findByIdAndDelete).toHaveBeenCalledWith(recordId);
  });

  it("throws error if attendance record not found when deleting", async () => {
    const recordId = new mongoose.Types.ObjectId().toString();

    attendanceModelMock.findById.mockResolvedValue(null);

    const service = await loadService();
    await expect(service.deleteAttendanceRecord(recordId)).rejects.toThrow("Запис відвідування не знайдено");
  });
});
