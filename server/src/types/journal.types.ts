import mongoose from "mongoose";

export interface IJournalEntry {
  student: mongoose.Schema.Types.ObjectId;
  mark?: number | null;
}

export interface IJournal {
  _id?: string;
  subject: mongoose.Schema.Types.ObjectId;
  grade: number;
  entries: IJournalEntry[];
  lessons?: ILesson[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IJournalEntryResponse {
  student: {
    id: string;
    name: string;
    email: string;
    birthdate?: Date;
    grade?: number;
    isArchived?: boolean;
    archivedAt?: Date;
    isTransferred?: boolean;
  };
  mark: number | null;
}

export interface IJournalResponse {
  id: string;
  grade: number;
  entries: IJournalEntryResponse[];
  lessons?: ILessonResponse[];
  createdAt: Date;
}

export interface ILesson {
  _id?: string | mongoose.Schema.Types.ObjectId;
  topic: string;
  date?: Date;
  marks: {
    student: mongoose.Schema.Types.ObjectId;
    mark?: number | null;
  }[];
}

export interface ILessonResponse {
  id: string;
  topic: string;
  date: Date;
  marks: {
    student: IJournalEntryResponse["student"];
    mark: number | null;
    isAbsent?: boolean;
  }[];
}
