export interface SubjectTeacher {
  id: string;
  name: string;
  email: string;
  role: "teacher";
}

export interface Subject {
  id: string;
  name: string;
  teacher: SubjectTeacher | null;
  createdAt: string;
}

export interface JournalEntry {
  student: {
    id: string;
    name: string;
    email: string;
    grade?: number;
    isArchived?: boolean;
    archivedAt?: string;
    isTransferred?: boolean;
  };
  mark: number | null;
}

export interface LessonMark {
  student: JournalEntry["student"];
  mark: number | null;
  isAbsent?: boolean;
}

export interface Lesson {
  id: string;
  topic: string;
  date: string;
  marks: LessonMark[];
}

export interface Journal {
  id: string;
  grade: number;
  entries: JournalEntry[];
  lessons?: Lesson[];
  createdAt: string;
}

export interface SubjectDetail {
  subject: Subject;
  journals: Journal[];
}

export interface SubjectMaterial {
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
  uploadedAt: string;
}
