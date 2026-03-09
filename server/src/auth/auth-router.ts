import { Router } from "express";
import authController from "./auth-controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const authRouter = Router();

authRouter.post("/register", authController.register);
authRouter.post("/login", authController.login);
authRouter.post("/refresh", authController.refresh);
authRouter.post("/logout", authController.logout);

// Password reset endpoint (public - no auth required)
authRouter.post("/reset-password/:token", authController.resetPassword);

// Admin endpoints for managing registration requests
authRouter.get("/requests", authMiddleware, requireRole(["admin"]), authController.listRequests);
authRouter.post("/requests/:id/approve", authMiddleware, requireRole(["admin"]), authController.approveRequest);
authRouter.delete("/requests/:id", authMiddleware, requireRole(["admin"]), authController.deleteRequest);

export default authRouter;
