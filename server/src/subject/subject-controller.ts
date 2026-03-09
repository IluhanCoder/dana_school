import { Request, Response } from "express";
import subjectService from "./subject-service";
import { ApiResponse } from "../types/api.types";
import { ISubjectMaterialResponse, ISubjectResponse } from "../types/subject.types";
import { IJournalResponse } from "../types/journal.types";
import userService from "../user/user-service";

export default new class SubjectController {
  async createSubject(req: Request, res: Response): Promise<Response<ApiResponse<ISubjectResponse>>> {
    try {
      const { name, teacherId } = req.body as { name: string; teacherId?: string };

      if (!name) {
        return res.status(400).json({ success: false, error: "Name is required" });
      }

      const subject = await subjectService.createSubject(name, teacherId);
      return res.status(201).json({ success: true, data: subject });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async getSubjects(req: any, res: Response): Promise<Response<ApiResponse<ISubjectResponse[]>>> {
    try {
      const userId = req.userId as string | undefined;
      let subjects: ISubjectResponse[];

      if (userId) {
        const user = await userService.getUserById(userId);
        if (user?.role === "teacher") {
          subjects = await subjectService.getSubjectsByTeacher(userId);
        } else if (user?.role === "student") {
          subjects = await subjectService.getSubjectsForStudent(user.grade);
        } else {
          subjects = await subjectService.getSubjects();
        }
      } else {
        subjects = await subjectService.getSubjects();
      }

      return res.json({ success: true, data: subjects });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async getSubject(req: any, res: Response): Promise<Response<ApiResponse<{ subject: ISubjectResponse; journals: IJournalResponse[] }>>> {
    try {
      const { id } = req.params;
      const includeArchived = req.query.includeArchived === "true";
      const userId = req.userId as string | undefined;
      const user = userId ? await userService.getUserById(userId) : null;
      const data = await subjectService.getSubjectWithJournals(id, user, includeArchived);
      return res.json({ success: true, data });
    } catch (error: any) {
      const status = error?.message === "Forbidden" ? 403 : 404;
      return res.status(status).json({ success: false, error: error.message });
    }
  }

  async updateSubjectTeacher(req: Request<{ id: string }>, res: Response): Promise<Response<ApiResponse<ISubjectResponse>>> {
    try {
      const { id } = req.params;
      const { teacherId } = req.body as { teacherId?: string };

      const subject = await subjectService.updateSubjectTeacher(id, teacherId);
      return res.json({ success: true, data: subject });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async deleteSubject(req: Request<{ id: string }>, res: Response): Promise<Response<ApiResponse<{ id: string }>>> {
    try {
      const { id } = req.params;
      const deleted = await subjectService.deleteSubject(id);
      return res.json({ success: true, data: deleted });
    } catch (error: any) {
      const status = /not found/i.test(error?.message) ? 404 : 400;
      return res.status(status).json({ success: false, error: error.message });
    }
  }

  async getMaterials(req: any, res: Response): Promise<Response<ApiResponse<ISubjectMaterialResponse[]>>> {
    try {
      const { id } = req.params;
      const userId = req.userId as string | undefined;
      const user = userId ? await userService.getUserById(userId) : null;

      const materials = await subjectService.getSubjectMaterials(id, user);
      return res.json({ success: true, data: materials });
    } catch (error: any) {
      const status = error?.message === "Forbidden" ? 403 : 404;
      return res.status(status).json({ success: false, error: error.message });
    }
  }

  async uploadMaterial(req: any, res: Response): Promise<Response<ApiResponse<ISubjectMaterialResponse>>> {
    try {
      const { id } = req.params;
      const file = req.file as Express.Multer.File | undefined;
      const userId = req.userId as string | undefined;
      const user = userId ? await userService.getUserById(userId) : null;

      if (!file) {
        return res.status(400).json({ success: false, error: "PDF file is required" });
      }

      const material = await subjectService.uploadSubjectMaterial(id, file, user);
      return res.status(201).json({ success: true, data: material });
    } catch (error: any) {
      const status = error?.message === "Forbidden" ? 403 : 400;
      return res.status(status).json({ success: false, error: error.message });
    }
  }

  async deleteMaterial(req: any, res: Response): Promise<Response<ApiResponse<{ id: string }>>> {
    try {
      const { id, materialId } = req.params;
      const userId = req.userId as string | undefined;
      const user = userId ? await userService.getUserById(userId) : null;

      const deleted = await subjectService.deleteSubjectMaterial(id, materialId, user);
      return res.json({ success: true, data: deleted });
    } catch (error: any) {
      let status = 400;
      if (error?.message === "Forbidden") status = 403;
      if (error?.message === "Subject not found" || error?.message === "Material not found") status = 404;
      return res.status(status).json({ success: false, error: error.message });
    }
  }

}();
