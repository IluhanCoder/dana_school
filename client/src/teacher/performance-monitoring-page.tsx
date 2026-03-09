import { useEffect, useMemo, useState } from "react";
import $api from "../api/api";
import type { ApiResponse } from "../types/api.types";
import type { Class, ClassDetail } from "../types/class.types";
import type { PerformancePoint, SubjectOption } from "../types/analytics.types";
import authService from "../auth/auth-service";
import PerformanceCharts from "../components/PerformanceCharts";
import type { Subject, SubjectDetail } from "../types/subject.types";

interface MyClassInfo {
  id: string;
  grade: number;
}

export default function PerformanceMonitoringPage() {
  const role = authService.getRole();
  const isAdmin = role === "admin";
  const isTeacher = role === "teacher";

  const [grades, setGrades] = useState<Class[]>([]);
  const [selectedGrade, setSelectedGrade] = useState("");
  const [students, setStudents] = useState<ClassDetail["students"]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [teacherMode, setTeacherMode] = useState<"class-teacher" | "subject-teacher" | null>(null);
  const [teacherSubjects, setTeacherSubjects] = useState<SubjectOption[]>([]);
  const [selectedTeacherSubjectId, setSelectedTeacherSubjectId] = useState("");
  const [studentsByTeacherSubject, setStudentsByTeacherSubject] = useState<Record<string, ClassDetail["students"]>>({});
  const [marks, setMarks] = useState<PerformancePoint[]>([]);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [loadingMarks, setLoadingMarks] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const init = async () => {
      try {
        setLoadingFilters(true);
        setError("");

        if (isTeacher) {
          const myClassResponse = await $api.get<ApiResponse<MyClassInfo | null>>("/users/my-class");
          if (myClassResponse.data.success && myClassResponse.data.data) {
            setTeacherMode("class-teacher");
            const grade = myClassResponse.data.data.grade;
            setSelectedGrade(String(grade));
            await loadStudentsForGrade(grade, true);
            return;
          }

          setTeacherMode("subject-teacher");
          await loadTeacherSubjectsAndStudents();
          return;
        }

        if (isAdmin) {
          const gradesResponse = await $api.get<ApiResponse<Class[]>>("/grades");
          if (!gradesResponse.data.success) {
            setError(gradesResponse.data.error || "Не вдалося завантажити класи");
            return;
          }

          const loadedGrades = gradesResponse.data.data || [];
          setGrades(loadedGrades);

          const initialGrade = loadedGrades.find((grade) => grade.studentCount > 0) || loadedGrades[0];
          if (initialGrade) {
            setSelectedGrade(String(initialGrade.grade));
            await loadStudentsForGrade(initialGrade.grade, true);
          }
          return;
        }

        setError("Сторінка доступна лише для вчителя та адміністратора");
      } catch (err: any) {
        setError(err?.response?.data?.error || err.message || "Не вдалося завантажити дані");
      } finally {
        setLoadingFilters(false);
      }
    };

    init();
  }, [isAdmin, isTeacher]);

  const loadTeacherSubjectsAndStudents = async () => {
    const subjectsResponse = await $api.get<ApiResponse<Subject[]>>("/subjects");
    if (!subjectsResponse.data.success) {
      throw new Error(subjectsResponse.data.error || "Не вдалося завантажити предмети викладача");
    }

    const ownSubjects = subjectsResponse.data.data || [];
    if (!ownSubjects.length) {
      setTeacherSubjects([]);
      setSelectedTeacherSubjectId("");
      setStudentsByTeacherSubject({});
      setStudents([]);
      setSelectedStudentId("");
      return;
    }

    const mappedSubjects = ownSubjects
      .map((subject) => ({ id: subject.id, name: subject.name }))
      .sort((a, b) => a.name.localeCompare(b.name, "uk-UA"));
    setTeacherSubjects(mappedSubjects);

    const details = await Promise.all(
      ownSubjects.map(async (subject) => {
        const detailResponse = await $api.get<ApiResponse<SubjectDetail>>(`/subjects/${subject.id}`);
        return {
          subjectId: subject.id,
          detail: detailResponse.data.success ? detailResponse.data.data : null,
        };
      })
    );

    const studentsBySubject: Record<string, ClassDetail["students"]> = {};

    details.forEach(({ subjectId, detail }) => {
      const map = new Map<string, ClassDetail["students"][number]>();

      (detail?.journals || []).forEach((journal) => {
        (journal.entries || []).forEach((entry) => {
          if ((entry.student as any).isArchived) return;
          if (!map.has(entry.student.id)) {
            map.set(entry.student.id, {
              id: entry.student.id,
              name: entry.student.name,
              email: entry.student.email,
              isArchived: (entry.student as any).isArchived,
            });
          }
        });
      });

      studentsBySubject[subjectId] = Array.from(map.values()).sort((a, b) =>
        a.name.localeCompare(b.name, "uk-UA")
      );
    });

    setStudentsByTeacherSubject(studentsBySubject);

    const firstSubjectId = mappedSubjects[0].id;
    setSelectedTeacherSubjectId(firstSubjectId);
    const firstStudents = studentsBySubject[firstSubjectId] || [];
    setStudents(firstStudents);
    setSelectedStudentId(firstStudents[0]?.id || "");
  };

  const loadStudentsForGrade = async (grade: number, resetSelection: boolean) => {
    const response = await $api.get<ApiResponse<ClassDetail>>(`/grades/${grade}`);
    if (!response.data.success) {
      throw new Error(response.data.error || "Не вдалося завантажити учнів класу");
    }

    const loadedStudents = response.data.data?.students || [];
    setStudents(loadedStudents);

    if (loadedStudents.length === 0) {
      setSelectedStudentId("");
      setMarks([]);
      return;
    }

    if (resetSelection) {
      setSelectedStudentId(loadedStudents[0].id);
      return;
    }

    setSelectedStudentId((prev) => {
      if (loadedStudents.some((student) => student.id === prev)) {
        return prev;
      }
      return loadedStudents[0].id;
    });
  };

  useEffect(() => {
    if (!isTeacher || teacherMode !== "subject-teacher") {
      return;
    }

    const currentStudents = studentsByTeacherSubject[selectedTeacherSubjectId] || [];
    setStudents(currentStudents);
    setSelectedStudentId((prev) => {
      if (currentStudents.some((student) => student.id === prev)) {
        return prev;
      }
      return currentStudents[0]?.id || "";
    });
  }, [isTeacher, teacherMode, selectedTeacherSubjectId, studentsByTeacherSubject]);

  useEffect(() => {
    const fetchPerformance = async () => {
      if (!selectedStudentId) {
        setMarks([]);
        return;
      }

      try {
        setLoadingMarks(true);
        setError("");

        const query = selectedTeacherSubjectId
          ? `?subjectId=${encodeURIComponent(selectedTeacherSubjectId)}`
          : "";
        const response = await $api.get<ApiResponse<PerformancePoint[]>>(`/users/${selectedStudentId}/performance${query}`);

        if (!response.data.success) {
          setError(response.data.error || "Не вдалося завантажити аналітику учня");
          return;
        }

        setMarks(response.data.data || []);
      } catch (err: any) {
        setError(err?.response?.data?.error || err.message || "Не вдалося завантажити аналітику учня");
      } finally {
        setLoadingMarks(false);
      }
    };

    fetchPerformance();
  }, [selectedStudentId, selectedTeacherSubjectId]);

  const handleGradeChange = async (gradeValue: string) => {
    setSelectedGrade(gradeValue);

    if (!gradeValue) {
      setStudents([]);
      setSelectedStudentId("");
      setMarks([]);
      return;
    }

    try {
      setLoadingFilters(true);
      setError("");
      await loadStudentsForGrade(Number(gradeValue), true);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || "Не вдалося змінити клас");
    } finally {
      setLoadingFilters(false);
    }
  };

  const subjects = useMemo<SubjectOption[]>(() => {
    const map = new Map<string, string>();
    marks.forEach((mark) => {
      if (!map.has(mark.subjectId)) {
        map.set(mark.subjectId, mark.subjectName);
      }
    });

    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "uk-UA"));
  }, [marks]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-16 space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-gray-900">Моніторинг встиганності</h1>
          <p className="text-gray-600 text-lg">Перегляд аналітики успішності обраного учня</p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-800 text-sm px-5 py-4 rounded flex items-start gap-3">
            <span className="text-red-500 text-xl">⚠</span>
            <p>{error}</p>
          </div>
        )}

        <div className="card p-6 shadow-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isAdmin ? (
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Клас</label>
                <select
                  value={selectedGrade}
                  onChange={(e) => handleGradeChange(e.target.value)}
                  className="input-field w-full"
                  disabled={loadingFilters}
                >
                  <option value="">Оберіть клас</option>
                  {grades.map((grade) => (
                    <option key={grade.id} value={grade.grade}>
                      {grade.grade} клас
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Клас</label>
                <div className="input-field w-full bg-gray-50 text-gray-700">
                  {teacherMode === "class-teacher"
                    ? (selectedGrade ? `${selectedGrade} клас` : "Немає призначеного класу")
                    : "Предметник"}
                </div>
              </div>
            )}

            {isTeacher && teacherMode === "subject-teacher" && (
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Мій предмет</label>
                <select
                  value={selectedTeacherSubjectId}
                  onChange={(e) => setSelectedTeacherSubjectId(e.target.value)}
                  className="input-field w-full"
                  disabled={loadingFilters || teacherSubjects.length === 0}
                >
                  {teacherSubjects.length === 0 ? (
                    <option value="">Немає призначених предметів</option>
                  ) : (
                    teacherSubjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Учень</label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="input-field w-full"
                disabled={loadingFilters || students.length === 0}
              >
                {students.length === 0 ? (
                  <option value="">Немає учнів</option>
                ) : (
                  students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name} ({student.email})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>
        </div>

        <PerformanceCharts marks={marks} subjects={subjects} loading={loadingMarks} />
      </div>
    </div>
  );
}
