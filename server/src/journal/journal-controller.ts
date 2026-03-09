import { Request, Response } from "express";
import { ApiResponse } from "../types/api.types";
import { IJournalResponse, ILessonResponse } from "../types/journal.types";
import userService from "../user/user-service";
import journalService from "./journal-service";

export default new class JournalController {
  async createJournal(req: Request<{ id: string }>, res: Response): Promise<Response<ApiResponse<IJournalResponse>>> {
    try {
      const { id } = req.params;
      const { classId } = req.body as { classId: string };

      if (!classId) {
        return res.status(400).json({ success: false, error: "Class ID is required" });
      }

      const journal = await journalService.createJournal(id, classId);
      return res.status(201).json({ success: true, data: journal });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async deleteJournal(req: Request<{ id: string; journalId: string }>, res: Response): Promise<Response<ApiResponse<null>>> {
    try {
      const { journalId } = req.params;
      const userId = (req as any).userId as string | undefined;
      const user = userId ? await userService.getUserById(userId) : null;
      await journalService.deleteJournal(journalId, user);
      return res.json({ success: true, data: null });
    } catch (error: any) {
      const status = error?.message === "Forbidden" ? 403 : 400;
      return res.status(status).json({ success: false, error: error.message });
    }
  }

  async syncJournalStudents(req: Request<{ id: string; journalId: string }>, res: Response): Promise<Response<ApiResponse<IJournalResponse>>> {
    try {
      const { journalId } = req.params;
      const journal = await journalService.syncJournalStudents(journalId);
      return res.json({ success: true, data: journal });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async addLesson(req: any, res: Response): Promise<Response<ApiResponse<ILessonResponse>>> {
    try {
      const { journalId } = req.params;
      const { topic, marks, date } = req.body as { topic: string; marks: Array<{ studentId: string; mark?: number | null }>; date?: string };
      const userId = req.userId as string | undefined;

      if (!topic?.trim()) {
        return res.status(400).json({ success: false, error: "Lesson topic is required" });
      }

      const user = userId ? await userService.getUserById(userId) : null;
      const lesson = await journalService.addLesson(journalId, topic, marks || [], date, user);
      return res.status(201).json({ success: true, data: lesson });
    } catch (error: any) {
      const status = error?.message === "Forbidden" ? 403 : 400;
      return res.status(status).json({ success: false, error: error.message });
    }
  }

  async deleteLesson(req: any, res: Response): Promise<Response<ApiResponse<null>>> {
    try {
      const { journalId, lessonId } = req.params;
      const userId = req.userId as string | undefined;

      const user = userId ? await userService.getUserById(userId) : null;
      await journalService.deleteLesson(journalId, lessonId, user);
      return res.json({ success: true, data: null });
    } catch (error: any) {
      const status = error?.message === "Forbidden" ? 403 : 404;
      return res.status(status).json({ success: false, error: error.message });
    }
  }

  async updateLessonMark(req: any, res: Response): Promise<Response<ApiResponse<ILessonResponse>>> {
    try {
      const { journalId, lessonId } = req.params;
      const { studentId, mark } = req.body as { studentId: string; mark: number | null };
      const userId = req.userId as string | undefined;

      if (!studentId) {
        return res.status(400).json({ success: false, error: "Student ID is required" });
      }

      if (mark !== null && (typeof mark !== "number" || mark < 0 || mark > 12)) {
        return res.status(400).json({ success: false, error: "Mark must be null or between 0 and 12" });
      }

      const user = userId ? await userService.getUserById(userId) : null;
      const lesson = await journalService.updateLessonMark(journalId, lessonId, studentId, mark, user);
      return res.json({ success: true, data: lesson });
    } catch (error: any) {
      const status = error?.message === "Forbidden" ? 403 : 404;
      return res.status(status).json({ success: false, error: error.message });
    }
  }

  async updateLessonTopic(req: any, res: Response): Promise<Response<ApiResponse<ILessonResponse>>> {
    try {
      const { journalId, lessonId } = req.params;
      const { topic } = req.body as { topic: string };
      const userId = req.userId as string | undefined;

      if (!topic?.trim()) {
        return res.status(400).json({ success: false, error: "Lesson topic is required" });
      }

      const user = userId ? await userService.getUserById(userId) : null;
      const lesson = await journalService.updateLessonTopic(journalId, lessonId, topic, user);
      return res.json({ success: true, data: lesson });
    } catch (error: any) {
      const status = error?.message === "Forbidden" ? 403 : 404;
      return res.status(status).json({ success: false, error: error.message });
    }
  }
}();
