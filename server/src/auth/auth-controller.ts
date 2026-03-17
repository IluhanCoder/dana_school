import { Request, Response } from "express";
import authService from "./auth-service";
import { ApiResponse } from "../types/api.types";
import { IAuthResponse } from "../types/auth.types";

function getRefreshCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: (isProduction ? "none" : "strict") as "none" | "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

export default new class AuthController {
  async register(req: Request, res: Response): Promise<Response<ApiResponse<{ message: string }>>> {
    try {
      const { name, email, password, requestedRole, birthdate } = req.body;

      // Validate input
      if (!name || !email || !password) {
        return res.status(400).json({ success: false, error: "Ім'я, email та пароль є обов'язковими" });
      }

      const result = await authService.registerRequest(name, email, password, requestedRole, birthdate);

      return res.status(201).json({ success: true, data: { message: result.message } });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async login(req: Request, res: Response): Promise<Response<ApiResponse<{ accessToken: string; user: any }>>> {
    try {
      const { login, email, password } = req.body as { login?: string; email?: string; password?: string };
      const loginIdentifier = (login || email || "").trim();

      // Validate input
      if (!loginIdentifier || !password) {
        return res.status(400).json({ success: false, error: "ПІБ/email та пароль є обов'язковими" });
      }

      const result = await authService.login(loginIdentifier, password);

      // Set refresh token in httpOnly cookie
      res.cookie("refreshToken", result.refreshToken, getRefreshCookieOptions());

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
        return res.status(401).json({ success: false, error: "Refresh токен не знайдено" });
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
    res.clearCookie("refreshToken", getRefreshCookieOptions());
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
      res.cookie("refreshToken", result.refreshToken, getRefreshCookieOptions());

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
        return res.status(400).json({ success: false, error: "Пароль має містити щонайменше 6 символів" });
      }

      const result = await authService.resetPassword(token, password);
      return res.json({ success: true, data: { message: result.message } });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
};
