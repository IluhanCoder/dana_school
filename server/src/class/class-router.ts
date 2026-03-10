import { Router, Request, Response } from "express";
import { ClassService } from "./class-service";
import { authMiddleware, type AuthenticatedRequest } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

// Get all classes with form teachers
router.get("/", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const classes = await ClassService.getAllClasses();
    res.json({
      success: true,
      data: classes,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || "Не вдалося отримати класи",
    });
  }
});

// Get specific class with students
router.get("/:grade", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const grade = parseInt(req.params.grade as string);
    const classDetail = await ClassService.getClass(grade);

    if (!classDetail) {
      return res.status(404).json({
        success: false,
        error: "Клас не знайдено",
      });
    }

    res.json({
      success: true,
      data: classDetail,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || "Не вдалося отримати клас",
    });
  }
});

// Set form teacher for a class (admin only)
router.patch(
  "/:grade/form-teacher",
  authMiddleware,
  requireRole(["admin"]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const grade = parseInt(req.params.grade as string);
      const { teacherId } = req.body as { teacherId: string };

      if (!teacherId) {
        return res.status(400).json({
          success: false,
          error: "ID вчителя є обов'язковим",
        });
      }

      await ClassService.setFormTeacher(grade, teacherId);

      res.json({
        success: true,
        data: { message: "Form teacher assigned successfully" },
      });
    } catch (err: any) {
      const status = err.message === "Невалідний вчитель" ? 400 : 500;
      res.status(status).json({
        success: false,
        error: err.message || "Не вдалося призначити класного керівника",
      });
    }
  }
);

// Remove form teacher from a class (admin only)
router.delete(
  "/:grade/form-teacher",
  authMiddleware,
  requireRole(["admin"]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const grade = parseInt(req.params.grade as string);
      await ClassService.removeFormTeacher(grade);

      res.json({
        success: true,
        data: { message: "Form teacher removed successfully" },
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message || "Не вдалося зняти класного керівника",
      });
    }
  }
);

export default router;
