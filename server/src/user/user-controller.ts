import { Request, Response } from "express";
import userService from "./user-service";
import { importStudentsFromExcel } from "./user-import.service";
import { ApiResponse } from "../types/api.types";
import { IUserResponse, UserRole } from "../types/user.types";

export default new class UserController {
  async getUsers(req: Request, res: Response): Promise<Response<ApiResponse<any[]>>> {
    try {
      const includeArchived = req.query.includeArchived === "true";
      const users = await userService.fetchUserData(includeArchived);
      return res.json({ success: true, data: users });
    } catch (error) {
      return res.status(500).json({ success: false, error: "Failed to fetch users" });
    }
  }

  async getUserById(req: Request, res: Response): Promise<Response<ApiResponse<IUserResponse | null>>> {
    try {
      const { id } = req.params as { id: string };
      const user = await userService.getUserById(id);

      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      return res.json({ success: true, data: user });
    } catch (error) {
      return res.status(500).json({ success: false, error: "Failed to fetch user" });
    }
  }

  async createUser(req: Request, res: Response): Promise<Response<ApiResponse<IUserResponse>>> {
    try {
      const { name, email, password, role } = req.body as { name: string; email: string; password: string; role?: UserRole };

      if (!name || !email || !password) {
        return res.status(400).json({ success: false, error: "Name, email, and password are required" });
      }

      const newUser = await userService.createUser(name, email, password, role || "student");

      return res.status(201).json({
        success: true,
        data: {
          id: newUser._id?.toString() || "",
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
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
        return res.status(400).json({ success: false, error: "Role is required" });
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
        return res.status(400).json({ success: false, error: "Grade is required" });
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
        return res.status(400).json({ success: false, error: "No file uploaded" });
      }

      const grade = req.query.grade ? parseInt(req.query.grade as string, 10) : undefined;
      if (grade !== undefined && (!Number.isInteger(grade) || grade < 0 || grade > 8)) {
        return res.status(400).json({ success: false, error: "Grade must be a number between 0 and 8" });
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

  async deleteUser(req: Request<{ id: string }>, res: Response): Promise<Response<ApiResponse<{ id: string }>>> {
    try {
      const { id } = req.params;
      const deleted = await userService.deleteStudent(id);
      return res.json({ success: true, data: { id: deleted._id?.toString() || "" } });
    } catch (error: any) {
      const status = /not found/i.test(error?.message) ? 404 : 400;
      return res.status(status).json({ success: false, error: error.message });
    }
  }

  async restoreUser(req: Request<{ id: string }>, res: Response): Promise<Response<ApiResponse<{ id: string }>>> {
    try {
      const { id } = req.params;
      const restored = await userService.restoreUser(id);
      return res.json({ success: true, data: { id: restored._id?.toString() || "" } });
    } catch (error: any) {
      const status = /not found/i.test(error?.message) ? 404 : 400;
      return res.status(status).json({ success: false, error: error.message });
    }
  }

  async getMyClass(req: Request, res: Response): Promise<Response<ApiResponse<{ id: string; grade: number } | null>>> {
    try {
      const userId = (req as any).userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
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
      return res.status(500).json({ success: false, error: "Failed to fetch teacher class" });
    }
  }

  async getStudentPerformance(req: Request<{ id: string }>, res: Response): Promise<Response<ApiResponse<any[]>>> {
    try {
      const requesterId = (req as any).userId as string | undefined;
      if (!requesterId) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      const { id: studentId } = req.params;
      const subjectId = typeof req.query.subjectId === "string" ? req.query.subjectId : undefined;
      const points = await userService.getStudentPerformance(requesterId, studentId, subjectId);

      return res.json({ success: true, data: points });
    } catch (error: any) {
      if (error?.message === "Unauthorized") {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      if (error?.message === "Forbidden") {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }

      if (error?.message === "Student not found") {
        return res.status(404).json({ success: false, error: "Student not found" });
      }

      return res.status(500).json({ success: false, error: error?.message || "Failed to fetch student performance" });
    }
  }
};