import { Request, Response } from "express";
import userService from "./user-service";
import { importStudentsFromExcel } from "./user-import.service";
import { ApiResponse } from "../types/api.types";
import { IUserResponse, UserRole } from "../types/user.types";

export default new class UserController {
  async getUsers(req: Request, res: Response): Promise<Response<ApiResponse<any[]>>> {
    try {
      const includeArchived = req.query.includeArchived === "true";
      const roleQuery = typeof req.query.role === "string" ? req.query.role : undefined;
      const role = roleQuery === "student" || roleQuery === "teacher" || roleQuery === "admin"
        ? roleQuery
        : undefined;
      const users = await userService.fetchUserData(includeArchived, role);
      return res.json({ success: true, data: users });
    } catch (error) {
      return res.status(500).json({ success: false, error: "Не вдалося отримати користувачів" });
    }
  }

  async getUserById(req: Request, res: Response): Promise<Response<ApiResponse<IUserResponse | null>>> {
    try {
      const { id } = req.params as { id: string };
      const user = await userService.getUserById(id);

      if (!user) {
        return res.status(404).json({ success: false, error: "Користувача не знайдено" });
      }

      return res.json({ success: true, data: user });
    } catch (error) {
      return res.status(500).json({ success: false, error: "Не вдалося отримати користувача" });
    }
  }

  async createUser(req: Request, res: Response): Promise<Response<ApiResponse<IUserResponse>>> {
    try {
      const { name, email, password, role, birthdate } = req.body as { name: string; email: string; password: string; role?: UserRole; birthdate?: string };

      if (!name || !email || !password) {
        return res.status(400).json({ success: false, error: "Ім'я, email та пароль є обов'язковими" });
      }

      const newUser = await userService.createUser(name, email, password, role || "student", { birthdate });

      return res.status(201).json({
        success: true,
        data: {
          id: newUser._id?.toString() || "",
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          birthdate: (newUser as any).birthdate || (newUser as any).dateOfBirth,
          isArchived: (newUser as any).isArchived,
          archivedAt: (newUser as any).archivedAt,
          createdAt: newUser.createdAt || new Date(),
        },
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async updateUserRole(req: Request<{ id: string }>, res: Response): Promise<Response<ApiResponse<IUserResponse>>> {
    try {
      const { id } = req.params;
      const { role } = req.body as { role: UserRole };

      if (!role) {
        return res.status(400).json({ success: false, error: "Роль є обов'язковою" });
      }

      const updated = await userService.updateUserRole(id, role);

      return res.json({
        success: true,
        data: {
          id: updated._id?.toString() || "",
          name: updated.name,
          email: updated.email,
          role: updated.role,
          grade: (updated as any).grade,
          birthdate: (updated as any).birthdate || (updated as any).dateOfBirth,
          isArchived: (updated as any).isArchived,
          archivedAt: (updated as any).archivedAt,
          createdAt: updated.createdAt || new Date(),
        },
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async updateStudentClass(req: Request<{ id: string }>, res: Response): Promise<Response<ApiResponse<IUserResponse>>> {
    try {
      const { id } = req.params;
      const { grade } = req.body as { grade: number };

      if (grade === undefined || grade === null) {
        return res.status(400).json({ success: false, error: "Клас є обов'язковим" });
      }

      const updated = await userService.updateStudentClass(id, Number(grade));

      return res.json({
        success: true,
        data: {
          id: updated._id?.toString() || "",
          name: updated.name,
          email: updated.email,
          role: updated.role,
          grade: (updated as any).grade,
          birthdate: (updated as any).birthdate || (updated as any).dateOfBirth,
          isArchived: (updated as any).isArchived,
          archivedAt: (updated as any).archivedAt,
          createdAt: updated.createdAt || new Date(),
        },
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async importStudents(req: Request, res: Response): Promise<Response<ApiResponse<any>>> {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: "Файл не завантажено" });
      }

      const grade = req.query.grade ? parseInt(req.query.grade as string, 10) : undefined;
      if (grade !== undefined && (!Number.isInteger(grade) || grade < 0 || grade > 8)) {
        return res.status(400).json({ success: false, error: "Клас має бути числом від 0 до 8" });
      }

      const result = await importStudentsFromExcel(req.file.buffer, grade);

      return res.json({
        success: true,
        data: {
          message: `Imported ${result.created} students successfully`,
          created: result.created,
          skipped: result.skipped,
          errors: result.errors,
        },
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async updateUserBirthdate(req: Request<{ id: string }>, res: Response): Promise<Response<ApiResponse<IUserResponse>>> {
    try {
      const { id } = req.params;
      const { birthdate } = req.body as { birthdate?: string | null };

      const updated = await userService.updateUserBirthdate(id, birthdate ?? undefined);

      return res.json({
        success: true,
        data: {
          id: updated._id?.toString() || "",
          name: updated.name,
          email: updated.email,
          role: updated.role,
          grade: (updated as any).grade,
          birthdate: (updated as any).birthdate || (updated as any).dateOfBirth,
          isArchived: (updated as any).isArchived,
          archivedAt: (updated as any).archivedAt,
          createdAt: updated.createdAt || new Date(),
        },
      });
    } catch (error: any) {
      const status = /не знайдено/i.test(error?.message) ? 404 : 400;
      return res.status(status).json({ success: false, error: error.message });
    }
  }

  async deleteUser(req: Request<{ id: string }>, res: Response): Promise<Response<ApiResponse<{ id: string }>>> {
    try {
      const { id } = req.params;
      const deleted = await userService.deleteStudent(id);
      return res.json({ success: true, data: { id: deleted._id?.toString() || "" } });
    } catch (error: any) {
      const status = /не знайдено/i.test(error?.message) ? 404 : 400;
      return res.status(status).json({ success: false, error: error.message });
    }
  }

  async restoreUser(req: Request<{ id: string }>, res: Response): Promise<Response<ApiResponse<{ id: string }>>> {
    try {
      const { id } = req.params;
      const restored = await userService.restoreUser(id);
      return res.json({ success: true, data: { id: restored._id?.toString() || "" } });
    } catch (error: any) {
      const status = /не знайдено/i.test(error?.message) ? 404 : 400;
      return res.status(status).json({ success: false, error: error.message });
    }
  }

  async getMyClass(req: Request, res: Response): Promise<Response<ApiResponse<{ id: string; grade: number } | null>>> {
    try {
      const userId = (req as any).userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: "Неавторизовано" });
      }

      const classInfo = await userService.getTeacherClass(userId);
      
      if (!classInfo) {
        return res.json({ success: true, data: null });
      }

      return res.json({
        success: true,
        data: classInfo,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: "Не вдалося отримати клас класного керівника" });
    }
  }

  async getStudentPerformance(req: Request<{ id: string }>, res: Response): Promise<Response<ApiResponse<any[]>>> {
    try {
      const requesterId = (req as any).userId as string | undefined;
      if (!requesterId) {
        return res.status(401).json({ success: false, error: "Неавторизовано" });
      }

      const { id: studentId } = req.params;
      const subjectId = typeof req.query.subjectId === "string" ? req.query.subjectId : undefined;
      const points = await userService.getStudentPerformance(requesterId, studentId, subjectId);

      return res.json({ success: true, data: points });
    } catch (error: any) {
      if (error?.message === "Неавторизовано") {
        return res.status(401).json({ success: false, error: "Неавторизовано" });
      }

      if (error?.message === "Заборонено") {
        return res.status(403).json({ success: false, error: "Заборонено" });
      }

      if (error?.message === "Учня не знайдено") {
        return res.status(404).json({ success: false, error: "Учня не знайдено" });
      }

      return res.status(500).json({ success: false, error: error?.message || "Не вдалося отримати успішність учня" });
    }
  }
};