import subjectModel from "./subject-model";
import userModel from "../user/user-model";
import { ISubjectMaterialResponse, ISubjectResponse } from "../types/subject.types";
import { IJournalResponse } from "../types/journal.types";
import journalService from "../journal/journal-service";
import googleStorageService from "../services/google-storage.service";
import journalModel from "../journal/journal-model";

export default new class SubjectService {
  private mapMaterial(material: any): ISubjectMaterialResponse {
    const uploadedBy = material?.uploadedBy || {};
    return {
      id: material?._id?.toString() || "",
      title: material?.title,
      url: material?.url,
      size: material?.size,
      mimeType: material?.mimeType,
      uploadedBy: {
        id: uploadedBy?._id?.toString() || "",
        name: uploadedBy?.name || "",
        email: uploadedBy?.email || "",
      },
      uploadedAt: material?.uploadedAt || new Date(),
    };
  }

  private ensureTeacherOrAdminAccess(subject: any, user?: { id: string; role?: string } | null) {
    if (!user || (user.role !== "admin" && user.role !== "teacher")) {
      throw new Error("Forbidden");
    }

    if (user.role === "teacher") {
      const teacherId = (subject.teacher as any)?._id?.toString() || subject.teacher?.toString();
      if (!teacherId || teacherId !== user.id) {
        throw new Error("Forbidden");
      }
    }
  }

  private mapSubject(subject: any): ISubjectResponse {
    const teacher = subject.teacher || null;
    return {
      id: subject._id?.toString() || "",
      name: subject.name,
      teacher: teacher
        ? {
            id: teacher._id?.toString() || "",
            name: teacher.name,
            email: teacher.email,
            role: "teacher",
          }
        : null,
      createdAt: subject.createdAt || new Date(),
    };
  }

  async createSubject(name: string, teacherId?: string): Promise<ISubjectResponse> {
    if (!name) {
      throw new Error("Name is required");
    }

    let normalizedTeacherId: string | null = null;

    if (teacherId && teacherId.trim()) {
      const teacher = await userModel.findById(teacherId);
      if (!teacher) {
        throw new Error("Teacher not found");
      }
      if (teacher.role !== "teacher") {
        throw new Error("Selected user is not a teacher");
      }
      normalizedTeacherId = teacher._id?.toString() || teacherId;
    }

    const existing = await subjectModel.findOne({ name, teacher: normalizedTeacherId });
    if (existing) {
      throw new Error("Subject already exists for this teacher");
    }

    const subject = await subjectModel.create({ name, teacher: normalizedTeacherId });
    const populated = await subject.populate("teacher", "name email role");
    return this.mapSubject(populated);
  }

  async getSubjects(): Promise<ISubjectResponse[]> {
    const subjects = await subjectModel.find().populate("teacher", "name email role");
    return subjects.map((s) => this.mapSubject(s));
  }

  async getSubjectsByTeacher(teacherId: string): Promise<ISubjectResponse[]> {
    const subjects = await subjectModel.find({ teacher: teacherId }).populate("teacher", "name email role");
    return subjects.map((s) => this.mapSubject(s));
  }

  async getSubjectsForStudent(studentGrade?: number): Promise<ISubjectResponse[]> {
    if (typeof studentGrade !== "number") {
      return [];
    }

    const subjectIds = await (journalModel as any).distinct("subject", { grade: studentGrade });
    if (!subjectIds.length) {
      return [];
    }

    const subjects = await subjectModel
      .find({ _id: { $in: subjectIds } })
      .populate("teacher", "name email role");

    return subjects.map((s) => this.mapSubject(s));
  }

  async getSubjectWithJournals(subjectId: string, user?: { id: string; role?: string; grade?: number } | null, includeArchived = false): Promise<{ subject: ISubjectResponse; journals: IJournalResponse[] }> {
    const subject = await subjectModel.findById(subjectId).populate("teacher", "name email role");
    if (!subject) throw new Error("Subject not found");

    if (user?.role === "teacher") {
      const teacherId = (subject.teacher as any)?._id?.toString();
      if (!teacherId || teacherId !== user.id) {
        throw new Error("Forbidden");
      }
    }

    const journals = await journalService.getJournalsForSubject(subjectId, includeArchived);

    if (user?.role === "student") {
      if (typeof user.grade !== "number") {
        throw new Error("Forbidden");
      }

      const studentJournals = journals
        .filter((journal) => journal.grade === user.grade)
        .map((journal) => ({
          ...journal,
          entries: journal.entries.filter((entry) => entry.student.id === user.id),
          lessons: (journal.lessons || []).map((lesson) => ({
            ...lesson,
            marks: (lesson.marks || []).filter((mark) => mark.student.id === user.id),
          })),
        }));

      if (studentJournals.length === 0) {
        throw new Error("Forbidden");
      }

      return { subject: this.mapSubject(subject), journals: studentJournals };
    }

    return { subject: this.mapSubject(subject), journals };
  }

  async updateSubjectTeacher(subjectId: string, teacherId?: string): Promise<ISubjectResponse> {
    const subject = await subjectModel.findById(subjectId);
    if (!subject) throw new Error("Subject not found");

    if (!teacherId || !teacherId.trim()) {
      subject.teacher = null as any;
    } else {
      const teacher = await userModel.findById(teacherId);
      if (!teacher) throw new Error("Teacher not found");
      if (teacher.role !== "teacher") {
        throw new Error("Selected user is not a teacher");
      }
      if ((teacher as any).isArchived) {
        throw new Error("Cannot assign archived teacher");
      }

      subject.teacher = teacher._id as any;
    }

    await subject.save();

    const populated = await subject.populate("teacher", "name email role");
    return this.mapSubject(populated);
  }

  async deleteSubject(subjectId: string): Promise<{ id: string }> {
    const subject = await subjectModel.findById(subjectId);
    if (!subject) {
      throw new Error("Subject not found");
    }

    await (journalModel as any).deleteMany({ subject: subjectId });
    await subjectModel.findByIdAndDelete(subjectId);

    return { id: subjectId };
  }

  async getSubjectMaterials(
    subjectId: string,
    user?: { id: string; role?: string } | null
  ): Promise<ISubjectMaterialResponse[]> {
    const subject = await subjectModel
      .findById(subjectId)
      .populate("teacher", "name email role")
      .populate("materials.uploadedBy", "name email");

    if (!subject) {
      throw new Error("Subject not found");
    }

    this.ensureTeacherOrAdminAccess(subject, user);

    const materials = [...((subject as any).materials || [])].sort(
      (a: any, b: any) =>
        new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime()
    );

    const mapped = await Promise.all(
      materials.map(async (material: any) => {
        const mappedMaterial = this.mapMaterial(material);

        if (!material?.storagePath) {
          return mappedMaterial;
        }

        try {
          const freshUrl = await googleStorageService.getSignedReadUrl(material.storagePath);
          return { ...mappedMaterial, url: freshUrl };
        } catch {
          return mappedMaterial;
        }
      })
    );

    return mapped;
  }

  async uploadSubjectMaterial(
    subjectId: string,
    file: Express.Multer.File,
    user?: { id: string; role?: string } | null
  ): Promise<ISubjectMaterialResponse> {
    const subject = await subjectModel
      .findById(subjectId)
      .populate("teacher", "name email role")
      .populate("materials.uploadedBy", "name email");

    if (!subject) {
      throw new Error("Subject not found");
    }

    this.ensureTeacherOrAdminAccess(subject, user);

    if (!file) {
      throw new Error("PDF file is required");
    }

    if (file.mimetype !== "application/pdf") {
      throw new Error("Only PDF files are allowed");
    }

    const uploadResult = await googleStorageService.uploadPdf({
      buffer: file.buffer,
      subjectId,
      originalName: file.originalname,
    });

    const material = {
      title: file.originalname,
      url: uploadResult.url,
      storagePath: uploadResult.storagePath,
      size: file.size,
      mimeType: file.mimetype,
      uploadedBy: user?.id,
      uploadedAt: new Date(),
    };

    (subject as any).materials = [...((subject as any).materials || []), material];
    await subject.save();

    const refreshed = await subjectModel
      .findById(subjectId)
      .populate("materials.uploadedBy", "name email");

    const latestMaterial = ((refreshed as any)?.materials || [])
      .slice()
      .sort((a: any, b: any) =>
        new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime()
      )[0];

    return this.mapMaterial(latestMaterial);
  }
}();
