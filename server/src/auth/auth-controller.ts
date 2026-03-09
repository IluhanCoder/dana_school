import { Request, Response } from "express";
import authService from "./auth-service";
import { ApiResponse } from "../types/api.types";
import { IAuthResponse } from "../types/auth.types";

export default new class AuthController {
  async register(req: Request, res: Response): Promise<Response<ApiResponse<{ message: string }>>> {
    try {
      const { name, email, password, requestedRole } = req.body;

      // Validate input
      if (!name || !email || !password) {
        return res.status(400).json({ success: false, error: "Name, email, and password are required" });
      }

      const result = await authService.registerRequest(name, email, password, requestedRole);

      return res.status(201).json({ success: true, data: { message: result.message } });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async login(req: Request, res: Response): Promise<Response<ApiResponse<{ accessToken: string; user: any }>>> {
    try {
      const { email, password } = req.body;

      // Validate input
      if (!email || !password) {
        return res.status(400).json({ success: false, error: "Email and password are required" });
      }

      const result = await authService.login(email, password);

      // Set refresh token in httpOnly cookie
      res.cookie("refreshToken", result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      return res.json({
        success: true,
        data: {
          accessToken: result.accessToken,
          user: result.user,
        },
      });
    } catch (error: any) {
      return res.status(401).json({ success: false, error: error.message });
    }
  }

  async refresh(req: Request, res: Response): Promise<Response<ApiResponse<{ accessToken: string }>>> {
    try {
      const refreshToken = req.cookies.refreshToken;

      if (!refreshToken) {
        return res.status(401).json({ success: false, error: "Refresh token not found" });
      }

      const result = await authService.refreshAccessToken(refreshToken);

      return res.json({
        success: true,
        data: {
          accessToken: result.accessToken,
        },
      });
    } catch (error: any) {
      return res.status(401).json({ success: false, error: error.message });
    }
  }

  async logout(req: Request, res: Response): Promise<Response<ApiResponse<{ message: string }>>> {
    res.clearCookie("refreshToken");
    return res.json({ success: true, data: { message: "Logged out successfully" } });
  }

  async listRequests(req: Request, res: Response): Promise<Response<ApiResponse<any>>> {
    try {
      const requests = await authService.listRegistrationRequests();
      return res.json({ success: true, data: requests });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async approveRequest(req: Request<{ id: string }>, res: Response): Promise<Response<ApiResponse<{ accessToken: string; user: any }>>> {
    try {
      const { id } = req.params;
      const result = await authService.approveRegistrationRequest(id);

      // Set refresh token in httpOnly cookie
      res.cookie("refreshToken", result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      return res.json({ success: true, data: { accessToken: result.accessToken, user: result.user } });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async deleteRequest(req: Request<{ id: string }>, res: Response): Promise<Response<ApiResponse<{ message: string }>>> {
    try {
      const { id } = req.params;
      const result = await authService.deleteRegistrationRequest(id);
      return res.json({ success: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async resetPassword(req: Request<{ token: string }>, res: Response): Promise<Response<ApiResponse<{ message: string }>>> {
    try {
      const { token } = req.params;
      const { password } = req.body;

      if (!password || password.length < 6) {
        return res.status(400).json({ success: false, error: "Password must be at least 6 characters" });
      }

      const result = await authService.resetPassword(token, password);
      return res.json({ success: true, data: { message: result.message } });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
};
