import { Router } from "express";
import attendanceController from "./attendance-controller";
import { authMiddleware, type AuthenticatedRequest } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

// Get attendance records for a class
router.get(
  "/:classId",
  authMiddleware,
  requireRole(["admin", "teacher"]),
  (req: any, res: any) => attendanceController.getAttendance(req, res)
);

// Add new attendance date
router.post(
  "/:classId",
  authMiddleware,
  requireRole(["admin", "teacher"]),
  (req: any, res: any) => attendanceController.addRecord(req, res)
);

// Update attendance for a student
router.patch(
  "/:classId/:recordId/:studentId",
  authMiddleware,
  requireRole(["admin", "teacher"]),
  (req: any, res: any) => attendanceController.updateAttendance(req, res)
);

// Delete attendance record
router.delete(
  "/:classId/:recordId",
  authMiddleware,
  requireRole(["admin", "teacher"]),
  (req: any, res: any) => attendanceController.deleteRecord(req, res)
);

export default router;
