import { Request, Response, NextFunction } from "express";
import authService from "../auth/auth-service";

export interface AuthenticatedRequest extends Request {
  userId?: string;
  email?: string;
}

export const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Заголовок авторизації відсутній" });
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    const decoded = authService.verifyToken(token);
    req.userId = decoded.id;
    req.email = decoded.email;

    next();
  } catch (error: any) {
    return res.status(401).json({ success: false, error: error.message });
  }
};
