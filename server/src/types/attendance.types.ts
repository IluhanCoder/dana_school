import mongoose from "mongoose";

export interface IAttendanceEntry {
  student: mongoose.Schema.Types.ObjectId;
  present: boolean;
}

export interface IAttendanceRecord {
  _id?: string;
  class: mongoose.Schema.Types.ObjectId;
  date: Date;
  entries: IAttendanceEntry[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IAttendanceEntryResponse {
  student: {
    id: string;
    name: string;
    email: string;
    isArchived?: boolean;
  };
  present: boolean;
}

export interface IAttendanceResponse {
  id: string;
  date: Date;
  entries: IAttendanceEntryResponse[];
  createdAt: Date;
  warning?: string;
}
