import { Request, Response, NextFunction } from "express";
import userService from "../user/user-service";

export const requireRole = (roles: Array<"student" | "teacher" | "admin">) => {
  return async (req: any, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;
      if (!userId) return res.status(401).json({ success: false, error: "Unauthorized" });
      const user = await userService.getUserById(userId);
      if (!user) return res.status(401).json({ success: false, error: "Unauthorized" });
      if (!roles.includes(user.role)) return res.status(403).json({ success: false, error: "Forbidden" });
      next();
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  };
};
