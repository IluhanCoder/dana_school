import $api from "../api/api";
import type { ApiResponse } from "../types/api.types";
import type {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  RefreshTokenResponse,
} from "../types/auth.types";

function decodeRoleFromToken(token: string | null): "student" | "teacher" | "admin" | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1] || ""));
    return payload?.role || null;
  } catch {
    return null;
  }
}

function decodeEmailFromToken(token: string | null): string | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1] || ""));
    return payload?.email || null;
  } catch {
    return null;
  }
}

function decodeIdFromToken(token: string | null): string | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1] || ""));
    return payload?.id || null;
  } catch {
    return null;
  }
}

function notifyAuthChanged() {
  window.dispatchEvent(new Event("auth:changed"));
}

export default new class AuthService {
  async login(
    email: string,
    password: string
  ): Promise<AuthResponse> {
    try {
      const response = await $api.post<ApiResponse<AuthResponse>>(
        "/auth/login",
        { email, password } as LoginRequest
      );

      if (response.data.success) {
        const { accessToken } = response.data.data;
        localStorage.setItem("token", accessToken);
        notifyAuthChanged();
        return response.data.data;
      }

      throw new Error(response.data.error);
    } catch (error: any) {
      throw new Error(error.response?.data?.error || "Не вдалося увійти");
    }
  }

  async register(
    name: string,
    email: string,
    password: string,
    birthdate?: string
  ): Promise<AuthResponse> {
    try {
      const response = await $api.post<ApiResponse<AuthResponse>>(
        "/auth/register",
        { name, email, password, birthdate } as RegisterRequest
      );

      if (response.data.success) {
        // New flow: server returns message, not tokens
        return response.data.data;
      }

      throw new Error(response.data.error);
    } catch (error: any) {
      throw new Error(error.response?.data?.error || "Не вдалося зареєструватися");
    }
  }

  async logout(): Promise<void> {
    try {
      await $api.post("/auth/logout");
      localStorage.removeItem("token");
      notifyAuthChanged();
    } catch (error: any) {
      throw new Error(error.response?.data?.error || "Не вдалося вийти");
    }
  }

  async refreshToken(): Promise<string> {
    try {
      const response = await $api.post<ApiResponse<RefreshTokenResponse>>(
        "/auth/refresh"
      );

      if (response.data.success) {
        const { accessToken } = response.data.data;
        localStorage.setItem("token", accessToken);
        notifyAuthChanged();
        return accessToken;
      }

      throw new Error(response.data.error);
    } catch (error: any) {
      localStorage.removeItem("token");
      notifyAuthChanged();
      throw new Error(error.response?.data?.error || "Не вдалося оновити токен");
    }
  }

  getAccessToken(): string | null {
    return localStorage.getItem("token");
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  getRole(): "student" | "teacher" | "admin" | null {
    return decodeRoleFromToken(this.getAccessToken());
  }

  isAdmin(): boolean {
    return this.getRole() === "admin";
  }

  getUserEmail(): string | null {
    return decodeEmailFromToken(this.getAccessToken());
  }

  getUserId(): string | null {
    return decodeIdFromToken(this.getAccessToken());
  }
};