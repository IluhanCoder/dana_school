import mongoose from "mongoose";

export interface IClass {
  _id?: string;
  grade: number;
  formTeacher?: string | mongoose.Schema.Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IClassResponse {
  id: string;
  grade: number;
  formTeacher?: {
    id: string;
    name: string;
    email: string;
  };
  studentCount: number;
  createdAt: Date;
}

export interface IClassDetail extends IClassResponse {
  students: Array<{
    id: string;
    name: string;
    email: string;
    isArchived?: boolean;
  }>;
}
