export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: "student" | "teacher" | "admin";
  };
}

export interface RefreshTokenResponse {
  accessToken: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role?: "student" | "teacher" | "admin";
  createdAt: Date;
}
