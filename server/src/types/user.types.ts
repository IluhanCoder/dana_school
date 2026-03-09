export type UserRole = "student" | "teacher" | "admin";

export interface IUser {
  _id?: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  grade?: number;
  accountNumber?: string;
  dateOfBirth?: Date;
  parentContact?: string;
  phone?: string;
  isArchived?: boolean;
  archivedAt?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IUserResponse {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  grade?: number;
  accountNumber?: string;
  dateOfBirth?: Date;
  parentContact?: string;
  phone?: string;
  isArchived?: boolean;
  archivedAt?: Date;
  createdAt: Date;
}
