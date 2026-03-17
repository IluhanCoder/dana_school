import { Router } from "express";
import multer from "multer";
import userController from "./user-controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const userRouter = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Protected routes - require authentication
userRouter.get("/", authMiddleware, userController.getUsers);
userRouter.post("/import/excel", authMiddleware, requireRole(["admin"]), upload.single("file"), userController.importStudents);
userRouter.get("/my-class", authMiddleware, requireRole(["teacher"]), userController.getMyClass);
userRouter.get("/:id/performance", authMiddleware, requireRole(["student", "teacher", "admin"]), userController.getStudentPerformance);

// Routes with :id parameter must come last
userRouter.get("/:id", authMiddleware, userController.getUserById);
userRouter.post("/", authMiddleware, requireRole(["admin"]), userController.createUser);
userRouter.patch("/:id/role", authMiddleware, requireRole(["admin"]), userController.updateUserRole);
userRouter.patch("/:id/class", authMiddleware, requireRole(["admin"]), userController.updateStudentClass);
userRouter.patch("/:id/email", authMiddleware, requireRole(["admin"]), userController.updateUserEmail);
userRouter.patch("/:id/birthdate", authMiddleware, requireRole(["admin"]), userController.updateUserBirthdate);
userRouter.patch("/:id/restore", authMiddleware, requireRole(["admin"]), userController.restoreUser);
userRouter.delete("/:id", authMiddleware, requireRole(["admin"]), userController.deleteUser);

export default userRouter;