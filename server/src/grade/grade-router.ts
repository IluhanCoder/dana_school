import { Router, Request, Response } from "express";
import { GradeService } from "./grade-service";
import { authMiddleware, type AuthenticatedRequest } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

// Get all grades with form teachers
router.get("/", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const grades = await GradeService.getAllGrades();
    res.json({
      success: true,
      data: grades,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || "Не вдалося отримати класи",
    });
  }
});

// Get specific grade with students
router.get("/:grade", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const gradeNumber = parseInt(req.params.grade as string);
    const gradeDetail = await GradeService.getGrade(gradeNumber);

    if (!gradeDetail) {
      return res.status(404).json({
        success: false,
        error: "Клас не знайдено",
      });
    }

    res.json({
      success: true,
      data: gradeDetail,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || "Не вдалося отримати клас",
    });
  }
});

// Set form teacher for a grade (admin only)
router.patch(
  "/:grade/form-teacher",
  authMiddleware,
  requireRole(["admin"]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const gradeNumber = parseInt(req.params.grade as string);
      const { teacherId } = req.body as { teacherId: string };

      if (!teacherId) {
        return res.status(400).json({
          success: false,
          error: "ID вчителя є обов'язковим",
        });
      }

      await GradeService.setFormTeacher(gradeNumber, teacherId);

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

// Remove form teacher from a grade (admin only)
router.delete(
  "/:grade/form-teacher",
  authMiddleware,
  requireRole(["admin"]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const gradeNumber = parseInt(req.params.grade as string);
      await GradeService.removeFormTeacher(gradeNumber);

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
