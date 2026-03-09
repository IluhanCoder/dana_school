export interface Class {
  id: string;
  grade: number;
  formTeacher?: {
    id: string;
    name: string;
    email: string;
  };
  studentCount: number;
  createdAt: string;
}

export interface ClassDetail extends Class {
  students: Array<{
    id: string;
    name: string;
    email: string;
    isArchived?: boolean;
  }>;
}
