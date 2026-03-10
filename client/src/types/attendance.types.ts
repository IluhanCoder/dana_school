export interface AttendanceEntry {
  student: {
    id: string;
    name: string;
    email: string;
    birthdate?: string;
    isArchived?: boolean;
  };
  present: boolean;
}

export interface AttendanceRecord {
  id: string;
  date: Date;
  entries: AttendanceEntry[];
  createdAt: Date;
  warning?: string;
}
