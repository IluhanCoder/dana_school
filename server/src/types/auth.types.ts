export interface IAuthRequest {
  email: string;
  password: string;
}

export interface IAuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: "student" | "teacher" | "admin";
  };
}

export interface IDecodedToken {
  id: string;
  email: string;
  role: "student" | "teacher" | "admin";
  iat: number;
  exp: number;
}

export interface IRegistrationRequest {
  _id?: string;
  name: string;
  email: string;
  passwordHash: string;
  requestedRole: "student" | "teacher" | "admin";
  createdAt?: Date;
  updatedAt?: Date;
}
