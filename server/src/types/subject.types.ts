import mongoose from "mongoose";

export interface ISubject {
  _id?: string;
  name: string;
  teacher?: mongoose.Schema.Types.ObjectId | string | null;
  materials?: ISubjectMaterial[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ISubjectMaterial {
  _id?: string;
  title: string;
  url: string;
  storagePath: string;
  size: number;
  mimeType: string;
  uploadedBy: mongoose.Schema.Types.ObjectId | string;
  uploadedAt?: Date;
}

export interface ISubjectMaterialResponse {
  id: string;
  title: string;
  url: string;
  size: number;
  mimeType: string;
  uploadedBy: {
    id: string;
    name: string;
    email: string;
  };
  uploadedAt: Date;
}

export interface ISubjectResponse {
  id: string;
  name: string;
  teacher: {
    id: string;
    name: string;
    email: string;
    role: "teacher";
  } | null;
  createdAt: Date;
}
