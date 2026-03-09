import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import $api from "../api/api";
import type { ApiResponse } from "../types/api.types";
import type { Journal, Lesson, SubjectDetail } from "../types/subject.types";
import type { Class } from "../types/class.types";
import authService from "../auth/auth-service";
import { ConfirmModal } from "../components/ConfirmModal";

interface TeacherOption {
  _id: string;
  name: string;
  email: string;
  role?: string;
  isArchived?: boolean;
}

export default function SubjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<SubjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [gradeInput, setGradeInput] = useState<string>("");
  const [classes, setClasses] = useState<Class[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [lessonTopic, setLessonTopic] = useState("");
  const [lessonDate, setLessonDate] = useState("");
  const [creatingLessonFor, setCreatingLessonFor] = useState<string>("");
  const [editingMark, setEditingMark] = useState<{ journalId: string; lessonId: string; studentId: string } | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [savingMark, setSavingMark] = useState(false);
  const [syncingJournalId, setSyncingJournalId] = useState<string>("");
  const [showArchivedStudents, setShowArchivedStudents] = useState(false);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [teacherLoading, setTeacherLoading] = useState(false);
  const [teacherError, setTeacherError] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [savingTeacher, setSavingTeacher] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [journalForDelete, setJournalForDelete] = useState<{ id: string; grade: number } | null>(null);
  const [deletingJournal, setDeletingJournal] = useState(false);
  const [lessonDeleteModalOpen, setLessonDeleteModalOpen] = useState(false);
  const [lessonForDelete, setLessonForDelete] = useState<{ journalId: string; lessonId: string; topic: string } | null>(null);
  const [deletingLesson, setDeletingLesson] = useState(false);
  const [editingLessonTopic, setEditingLessonTopic] = useState<{ journalId: string; lessonId: string } | null>(null);
  const [editingLessonTopicValue, setEditingLessonTopicValue] = useState("");
  const [savingLessonTopic, setSavingLessonTopic] = useState(false);
  const role = authService.getRole();
  const isAdmin = authService.isAdmin();
  const canToggleArchivedStudents = role !== "student";
  const shouldShowArchivedStudents = canToggleArchivedStudents && showArchivedStudents;

  useEffect(() => {
    if (!id) return;
    fetchDetail(id, shouldShowArchivedStudents);
    fetchClasses();
  }, [id, shouldShowArchivedStudents]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchTeachers();
  }, [isAdmin]);

  useEffect(() => {
    setSelectedTeacherId(detail?.subject?.teacher?.id || "");
  }, [detail?.subject?.teacher?.id]);

  const availableClasses = useMemo(() => {
    const usedClassIds = new Set((detail?.journals || []).map((j: any) => j.class?.id || j.classId));
    return classes.filter((c) => !usedClassIds.has(c.id));
  }, [detail, classes]);

  const fetchDetail = async (subjectId: string, includeArchived = false) => {
    try {
      setLoading(true);
      setError("");
      const url = includeArchived ? `/subjects/${subjectId}?includeArchived=true` : `/subjects/${subjectId}`;
      const response = await $api.get<ApiResponse<SubjectDetail>>(url);
      const resp = response.data;
      if (!resp.success) {
        setError(resp.error);
        return;
      }
      setDetail(resp.data);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || "Не вдалося завантажити предмет");
    } finally {
      setLoading(false);
    }
  };

  const fetchTeachers = async () => {
    try {
      setTeacherLoading(true);
      setTeacherError("");
      const response = await $api.get<ApiResponse<TeacherOption[]>>("/users");
      const resp = response.data;
      if (!resp.success) {
        setTeacherError(resp.error || "Не вдалося завантажити викладачів");
        return;
      }
      const teacherUsers = resp.data.filter((u) => u.role === "teacher" && !u.isArchived);
      setTeachers(teacherUsers);
    } catch (err: any) {
      setTeacherError(err?.response?.data?.error || err.message || "Не вдалося завантажити викладачів");
    } finally {
      setTeacherLoading(false);
    }
  };

  const fetchClasses = async () => {
    try {
      setClassesLoading(true);
      const response = await $api.get<ApiResponse<Class[]>>("/grades");
      if (response.data.success) {
        setClasses(response.data.data);
      }
    } catch (err: any) {
      console.error("Failed to fetch grades:", err);
    } finally {
      setClassesLoading(false);
    }
  };

  const handleUpdateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    try {
      setSavingTeacher(true);
      setTeacherError("");
      const response = await $api.patch<ApiResponse<any>>(`/subjects/${id}/teacher`, { teacherId: selectedTeacherId });
      const resp = response.data;
      if (!resp.success) {
        setTeacherError(resp.error || "Не вдалося змінити викладача");
        return;
      }
      setDetail((prev) => (prev ? { ...prev, subject: resp.data } : prev));
    } catch (err: any) {
      setTeacherError(err?.response?.data?.error || err.message || "Не вдалося змінити викладача");
    } finally {
      setSavingTeacher(false);
    }
  };

  const handleCreateJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    const classId = gradeInput;
    if (!classId) {
      setError("Оберіть клас");
      return;
    }

    try {
      setCreating(true);
      setError("");
      const response = await $api.post<ApiResponse<Journal>>(`/subjects/${id}/journals`, { classId });
      const resp = response.data;
      if (!resp.success) {
        setError(resp.error);
        return;
      }
      setDetail((prev) =>
        prev ? { ...prev, journals: [...prev.journals, resp.data].sort((a, b) => a.grade - b.grade) } : prev
      );
      setGradeInput("");
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || "Не вдалося створити журнал");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteJournal = async (journalId: string, grade: number) => {
    if (!id || (!isAdmin && !isTeacherOfSubject())) return;
    setJournalForDelete({ id: journalId, grade });
    setDeleteModalOpen(true);
  };

  const confirmDeleteJournal = async () => {
    if (!journalForDelete || !id) return;
    try {
      setDeletingJournal(true);
      setError("");
      const response = await $api.delete<ApiResponse<null>>(`/subjects/${id}/journals/${journalForDelete.id}`);
      const resp = response.data;
      if (!resp.success) {
        setError(resp.error);
        return;
      }
      setDetail((prev) => (prev ? { ...prev, journals: prev.journals.filter((j) => j.id !== journalForDelete.id) } : prev));
      setDeleteModalOpen(false);
      setJournalForDelete(null);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || "Не вдалося видалити журнал");
    } finally {
      setDeletingJournal(false);
    }
  };

  const handleSyncJournal = async (journalId: string) => {
    if (!id || !isAdmin) return;

    try {
      setSyncingJournalId(journalId);
      setError("");
      const response = await $api.post<ApiResponse<Journal>>(`/subjects/${id}/journals/${journalId}/sync`);
      const resp = response.data;
      if (!resp.success) {
        setError(resp.error);
        return;
      }
      setDetail((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          journals: prev.journals.map((j) => (j.id === journalId ? resp.data : j)),
        };
      });
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || "Не вдалося оновити список учнів");
    } finally {
      setSyncingJournalId("");
    }
  };

  const handleOpenLesson = (journal: Journal) => {
    if (!isAdmin && !isTeacherOfSubject()) return;
    setCreatingLessonFor(journal.id);
    setLessonTopic("");
    setLessonDate(new Date().toISOString().slice(0, 10));
  };

  const isTeacherOfSubject = (): boolean => {
    if (!detail) return false;
    const userId = authService.getUserId();
    return userId === detail.subject.teacher?.id;
  };

  const handleSubmitLesson = async (journal: Journal, e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin && !isTeacherOfSubject()) {
      setError("Forbidden");
      return;
    }
    if (!lessonTopic.trim()) {
      setError("Тема уроку обов'язкова");
      return;
    }
    if (!lessonDate) {
      setError("Дата уроку обов'язкова");
      return;
    }
    try {
      setCreating(true);
      setError("");
      const payload = {
        topic: lessonTopic.trim(),
        date: lessonDate,
        marks: journal.entries.map((entry) => ({
          studentId: entry.student.id,
          mark: null,
        })),
      };
      const response = await $api.post<ApiResponse<Lesson>>(`/subjects/journals/${journal.id}/lessons`, payload);
      const resp = response.data;
      if (!resp.success) {
        setError(resp.error);
        return;
      }
      setDetail((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          journals: prev.journals.map((j) =>
            j.id === journal.id ? { ...j, lessons: [...(j.lessons || []), resp.data] } : j
          ),
        };
      });
      setCreatingLessonFor("");
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || "Не вдалося створити урок");
    } finally {
      setCreating(false);
    }
  };

  const handleEditMark = (journalId: string, lessonId: string, studentId: string, currentMark: number | null) => {
    if (!isAdmin && !isTeacherOfSubject()) return;
    setEditingMark({ journalId, lessonId, studentId });
    setEditingValue(currentMark?.toString() || "");
  };

  const handleSaveMark = async (journalId: string, lessonId: string) => {
    if (!editingMark || editingMark.journalId !== journalId || editingMark.lessonId !== lessonId) return;

    const mark = editingValue === "" ? null : Number(editingValue);
    if (mark !== null && (isNaN(mark) || mark < 0 || mark > 12)) {
      setError("Оцінка повинна бути число від 0 до 12 або порожнім полем");
      return;
    }

    try {
      setSavingMark(true);
      setError("");
      const response = await $api.patch<ApiResponse<Lesson>>(`/subjects/journals/${journalId}/lessons/${lessonId}`, {
        studentId: editingMark.studentId,
        mark,
      });
      const resp = response.data;
      if (!resp.success) {
        setError(resp.error);
        return;
      }

      setDetail((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          journals: prev.journals.map((j) => {
            if (j.id === journalId) {
              return {
                ...j,
                lessons: (j.lessons || []).map((l) => (l.id === lessonId ? resp.data : l)),
              };
            }
            return j;
          }),
        };
      });
      setEditingMark(null);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || "Не вдалося зберегти оцінку");
    } finally {
      setSavingMark(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingMark(null);
  };

  const handleDeleteLesson = (journalId: string, lessonId: string, topic: string) => {
    if (!isAdmin && !isTeacherOfSubject()) return;
    setLessonForDelete({ journalId, lessonId, topic });
    setLessonDeleteModalOpen(true);
  };

  const confirmDeleteLesson = async () => {
    if (!lessonForDelete) return;

    try {
      setDeletingLesson(true);
      setError("");
      const response = await $api.delete<ApiResponse<null>>(
        `/subjects/journals/${lessonForDelete.journalId}/lessons/${lessonForDelete.lessonId}`
      );
      const resp = response.data;
      if (!resp.success) {
        setError(resp.error || "Не вдалося видалити урок");
        return;
      }

      setDetail((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          journals: prev.journals.map((journal) =>
            journal.id === lessonForDelete.journalId
              ? {
                  ...journal,
                  lessons: (journal.lessons || []).filter(
                    (lesson) => lesson.id !== lessonForDelete.lessonId
                  ),
                }
              : journal
          ),
        };
      });

      setLessonDeleteModalOpen(false);
      setLessonForDelete(null);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || "Не вдалося видалити урок");
    } finally {
      setDeletingLesson(false);
    }
  };

  const handleStartEditLessonTopic = (journalId: string, lessonId: string, topic: string) => {
    if (!isAdmin && !isTeacherOfSubject()) return;
    setEditingLessonTopic({ journalId, lessonId });
    setEditingLessonTopicValue(topic || "");
  };

  const handleCancelEditLessonTopic = () => {
    setEditingLessonTopic(null);
    setEditingLessonTopicValue("");
  };

  const handleSaveLessonTopic = async (journalId: string, lessonId: string) => {
    if (!editingLessonTopic || editingLessonTopic.journalId !== journalId || editingLessonTopic.lessonId !== lessonId) return;

    const nextTopic = editingLessonTopicValue.trim();
    if (!nextTopic) {
      setError("Тема уроку обов'язкова");
      return;
    }

    try {
      setSavingLessonTopic(true);
      setError("");
      const response = await $api.patch<ApiResponse<Lesson>>(`/subjects/journals/${journalId}/lessons/${lessonId}/topic`, {
        topic: nextTopic,
      });
      const resp = response.data;
      if (!resp.success) {
        setError(resp.error || "Не вдалося оновити тему уроку");
        return;
      }

      setDetail((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          journals: prev.journals.map((j) => {
            if (j.id !== journalId) return j;
            return {
              ...j,
              lessons: (j.lessons || []).map((lesson) => (lesson.id === lessonId ? resp.data : lesson)),
            };
          }),
        };
      });

      setEditingLessonTopic(null);
      setEditingLessonTopicValue("");
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || "Не вдалося оновити тему уроку");
    } finally {
      setSavingLessonTopic(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-6xl mx-auto px-6 py-16 flex flex-col items-center justify-center min-h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600 font-medium">Завантаження предмету...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-6xl mx-auto px-6 py-16 space-y-4">
          <button onClick={() => navigate(-1)} className="inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-700 mb-6">
            ← Назад до списку
          </button>
          <div className="bg-red-50 border-l-4 border-red-500 text-red-800 text-sm px-5 py-4 rounded flex items-start gap-3">
            <span className="text-red-500 text-xl">⚠</span>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!detail) return null;

  const { subject, journals } = detail;
  const currentLessonJournal = journals.find((journal) => journal.id === creatingLessonFor);
  const currentLessonVisibleEntries = currentLessonJournal
    ? (shouldShowArchivedStudents
        ? currentLessonJournal.entries
        : currentLessonJournal.entries.filter((entry) => entry.student.isArchived !== true && !entry.student.archivedAt))
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12 space-y-6">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
          >
            ← Назад
          </button>

          {(isAdmin || isTeacherOfSubject() || role === "student") && (
            <button
              onClick={() => navigate(`/subjects/${id}/materials`)}
              className="inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors ml-4"
            >
              📄 Матеріали PDF
            </button>
          )}

          <div className="flex items-start justify-between gap-8 flex-col lg:flex-row">
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-gray-900 mb-3">{subject.name}</h1>
              <p className="text-lg text-gray-600 mb-2">
                Викладач: <span className="font-semibold text-gray-900">{subject.teacher?.name || "Не призначено"}</span>
              </p>
              {subject.createdAt && (
                <p className="text-sm text-gray-500">
                  Створено {new Date(subject.createdAt).toLocaleDateString("uk-UA", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              )}
            </div>

            {isAdmin && (
              <div className="w-full lg:w-[36rem] grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                <div className="card p-6 shadow-lg h-full">
                  <h3 className="text-lg font-bold text-gray-900 mb-6">Змінити викладача</h3>
                  <form className="space-y-5" onSubmit={handleUpdateTeacher}>
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-3">Викладач</label>
                      <select
                        value={selectedTeacherId}
                        onChange={(e) => setSelectedTeacherId(e.target.value)}
                        className="input-field w-full"
                        disabled={teacherLoading}
                      >
                        <option value="">— Без викладача —</option>
                        {teachers.map((t) => (
                          <option key={t._id} value={t._id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {teacherError && (
                      <div className="bg-red-50 border-l-4 border-red-500 text-red-800 text-sm px-4 py-3 rounded flex items-start gap-3">
                        <span className="text-red-500 text-xl">⚠</span>
                        <p>{teacherError}</p>
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={savingTeacher || teacherLoading}
                      className="btn-primary w-full py-3 shadow-lg hover:shadow-xl transition-shadow"
                    >
                      {savingTeacher ? "Збереження..." : "Зберегти"}
                    </button>
                  </form>
                </div>

                <div className="card p-6 shadow-lg h-full">
                  <h3 className="text-lg font-bold text-gray-900 mb-6">Новий журнал</h3>
                  <form className="space-y-5" onSubmit={handleCreateJournal}>
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-3">Виберіть клас</label>
                      <select
                        value={gradeInput}
                        onChange={(e) => setGradeInput(e.target.value)}
                        className="input-field w-full"
                        disabled={classesLoading}
                      >
                        <option value="">— Виберіть клас —</option>
                        {availableClasses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.grade} клас
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="submit"
                      disabled={creating || availableClasses.length === 0 || classesLoading}
                      className="btn-primary w-full py-3 shadow-lg hover:shadow-xl transition-shadow"
                    >
                      {creating ? "Створення..." : "Додати журнал"}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Journals */}
        <div className="space-y-8">
          {journals.length === 0 ? (
            <div className="card p-16 text-center shadow-md">
              <p className="text-gray-600 text-lg">Поки що немає створених журналів</p>
              {isAdmin && <p className="text-gray-500 text-sm mt-2">Натисніть на форму вище для додавання першого журналу</p>}
            </div>
          ) : (
            <>
              {canToggleArchivedStudents && (
                <div className="flex items-center justify-end">
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={showArchivedStudents}
                      onChange={(e) => setShowArchivedStudents(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    Показувати архівних
                  </label>
                </div>
              )}
              {journals.map((journal) => {
                const visibleEntries = shouldShowArchivedStudents
                  ? journal.entries
                  : journal.entries.filter((entry) => entry.student.isArchived !== true && !entry.student.archivedAt);
                const sortedLessons = [...(journal.lessons || [])].sort(
                  (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
                );
                return (
                  <div key={journal.id} className="card shadow-lg overflow-hidden">
                {/* Journal Header */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-8 py-6 border-b border-gray-200 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{journal.grade} клас</h3>
                    {journal.createdAt && (
                      <p className="text-xs text-gray-500 mt-2">
                        Створено {new Date(journal.createdAt).toLocaleDateString("uk-UA", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {(isAdmin || isTeacherOfSubject()) && (
                      <button
                        onClick={() => handleOpenLesson(journal)}
                        className="btn-secondary px-6"
                      >
                        + Додати урок
                      </button>
                    )}
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => handleSyncJournal(journal.id)}
                          disabled={syncingJournalId === journal.id}
                          className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors disabled:opacity-50 text-sm font-medium"
                          title="Оновити список учнів"
                        >
                          {syncingJournalId === journal.id ? "..." : "↻ Оновити учнів"}
                        </button>
                      </>
                    )}
                    {(isAdmin || isTeacherOfSubject()) && (
                      <button
                        onClick={() => handleDeleteJournal(journal.id, journal.grade)}
                        disabled={deletingJournal}
                        className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 p-2 rounded-lg transition-colors disabled:opacity-50"
                        title="Видалити журнал"
                      >
                        {deletingJournal ? "..." : "×"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Lessons Table */}
                {sortedLessons.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          <th className="px-6 py-3 text-left font-medium text-gray-900 sticky left-0 bg-gray-50 min-w-[260px] w-[260px] z-20 border-r border-gray-200">
                            Учень
                          </th>
                          {sortedLessons.map((lesson) => (
                            <th key={lesson.id} className="px-4 py-3 text-center font-medium text-gray-900 min-w-[120px]">
                              <div className="flex flex-col items-center">
                                {editingLessonTopic?.journalId === journal.id && editingLessonTopic?.lessonId === lesson.id ? (
                                  <div className="flex flex-col items-center gap-2 w-full max-w-[180px]">
                                    <input
                                      type="text"
                                      value={editingLessonTopicValue}
                                      onChange={(e) => setEditingLessonTopicValue(e.target.value)}
                                      className="w-full px-2 py-1 border border-gray-300 rounded text-center text-sm"
                                      autoFocus
                                    />
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => handleSaveLessonTopic(journal.id, lesson.id)}
                                        disabled={savingLessonTopic}
                                        className="px-2 py-1 text-xs bg-gray-900 text-white rounded hover:bg-gray-800 disabled:opacity-50"
                                      >
                                        ✓
                                      </button>
                                      <button
                                        onClick={handleCancelEditLessonTopic}
                                        disabled={savingLessonTopic}
                                        className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400 disabled:opacity-50"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="font-semibold">{lesson.topic}</span>
                                )}
                                <span className="text-xs text-gray-500 font-normal mt-1">
                                  {lesson.date ? new Date(lesson.date).toLocaleDateString("uk-UA") : ""}
                                </span>
                                {(isAdmin || isTeacherOfSubject()) && (
                                  <div className="mt-2 flex items-center gap-1">
                                    <button
                                      onClick={() => handleStartEditLessonTopic(journal.id, lesson.id, lesson.topic)}
                                      disabled={savingLessonTopic || deletingLesson}
                                      className="w-6 h-6 inline-flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                                      title="Змінити тему уроку"
                                    >
                                      ✎
                                    </button>
                                    <button
                                      onClick={() => handleDeleteLesson(journal.id, lesson.id, lesson.topic)}
                                      disabled={deletingLesson || savingLessonTopic}
                                      className="w-6 h-6 inline-flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                                      title="Видалити урок"
                                    >
                                      ×
                                    </button>
                                  </div>
                                )}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {visibleEntries.length === 0 ? (
                          <tr>
                            <td colSpan={sortedLessons.length + 1} className="px-6 py-6 text-center text-gray-500">
                              Немає учнів
                            </td>
                          </tr>
                        ) : (
                          visibleEntries.map((entry, idx) => {
                            const rowBgClass = idx % 2 === 0 ? "bg-white" : "bg-gray-50";
                            const marks: Record<string, number | null> = {};
                            sortedLessons.forEach((lesson) => {
                              const mark = lesson.marks.find((m) => m.student.id === entry.student.id)?.mark ?? null;
                              marks[lesson.id] = mark;
                            });
                            return (
                              <tr key={entry.student.id || idx} className={`border-b border-gray-200 ${rowBgClass}`}>
                                <td className={`px-6 py-3 font-medium text-gray-900 sticky left-0 min-w-[260px] w-[260px] z-10 border-r border-gray-200 ${rowBgClass}`}>
                                  {entry.student.name}
                                  {(entry.student.isArchived === true || entry.student.archivedAt) && (
                                    <span className="ml-2 inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-200 text-gray-700">
                                      Архів
                                    </span>
                                  )}
                                  {entry.student.isTransferred && (
                                    <span className="ml-2 inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">
                                      Переведено
                                    </span>
                                  )}
                                </td>
                                {sortedLessons.map((lesson) => {
                                  const isEditing =
                                    editingMark?.journalId === journal.id &&
                                    editingMark?.lessonId === lesson.id &&
                                    editingMark?.studentId === entry.student.id;
                                  const lessonMark = lesson.marks.find((m) => m.student.id === entry.student.id);
                                  const markValue = marks[lesson.id];
                                  const isAbsent = lessonMark?.isAbsent === true;
                                  const canEdit = (isAdmin || (isTeacherOfSubject() && !entry.student.isTransferred)) && !isAbsent;
                                  const displayValue = isAbsent ? "н" : (markValue ?? "—");
                                  return (
                                    <td key={lesson.id} className="px-4 py-3 text-center">
                                      {isEditing ? (
                                        <div className="flex gap-2 justify-center items-center">
                                          <input
                                            type="number"
                                            min="0"
                                            max="12"
                                            value={editingValue}
                                            onChange={(e) => setEditingValue(e.target.value)}
                                            className="w-16 px-2 py-1 border border-gray-900 rounded text-center focus:outline-none"
                                            autoFocus
                                          />
                                          <button
                                            onClick={() => handleSaveMark(journal.id, lesson.id)}
                                            disabled={savingMark}
                                            className="px-2 py-1 text-xs bg-gray-900 text-white rounded hover:bg-gray-800 disabled:opacity-50"
                                          >
                                            ✓
                                          </button>
                                          <button
                                            onClick={handleCancelEdit}
                                            disabled={savingMark}
                                            className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400 disabled:opacity-50"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      ) : (
                                        <div
                                          onClick={() => canEdit && handleEditMark(journal.id, lesson.id, entry.student.id, markValue)}
                                          className={`px-3 py-1 rounded font-medium ${
                                            canEdit
                                              ? "cursor-pointer hover:bg-gray-100"
                                              : ""
                                          } ${isAbsent ? "text-red-600" : markValue === null ? "text-gray-400" : "text-gray-900"}`}
                                        >
                                          {displayValue}
                                        </div>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="px-6 py-8 text-center text-gray-500 text-sm">Поки що немає уроків</div>
                )}
              </div>
            );
            })}
            </>
          )}
        </div>

        {(isAdmin || isTeacherOfSubject()) && currentLessonJournal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="Закрити"
              onClick={() => setCreatingLessonFor("")}
              className="absolute inset-0 bg-black/40"
            />
            <div className="relative w-full max-w-xl card p-8 shadow-2xl z-10">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Додати урок</h3>
                  <p className="text-gray-600 text-sm mt-1">{currentLessonJournal.grade} клас</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCreatingLessonFor("")}
                  className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 p-2 rounded-lg transition-colors"
                  aria-label="Закрити форму"
                >
                  ✕
                </button>
              </div>

              <form className="space-y-6" onSubmit={(e) => handleSubmitLesson(currentLessonJournal, e)}>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Тема уроку</label>
                  <input
                    type="text"
                    value={lessonTopic}
                    onChange={(e) => setLessonTopic(e.target.value)}
                    className="input-field"
                    placeholder="Введіть тему..."
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Дата уроку</label>
                  <input
                    type="date"
                    value={lessonDate}
                    onChange={(e) => setLessonDate(e.target.value)}
                    className="input-field"
                  />
                </div>

                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-900">
                    Оцінки всіх {currentLessonVisibleEntries.length} учнів будуть пусті. Ви можете їх заповнити пізніше.
                  </p>
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setCreatingLessonFor("")}
                    className="btn-secondary"
                  >
                    Скасувати
                  </button>
                  <button type="submit" disabled={creating} className="btn-primary">
                    {creating ? "Збереження..." : "Зберегти"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Journal Confirmation Modal */}
        <ConfirmModal
          isOpen={deleteModalOpen}
          title="Видалення журналу"
          message={journalForDelete ? `Видалити журнал ${journalForDelete.grade} класу? Це також видалить всі уроки та оцінки цього журналу.` : ""}
          confirmText="Видалити"
          cancelText="Скасувати"
          isDangerous
          isLoading={deletingJournal}
          onConfirm={confirmDeleteJournal}
          onCancel={() => {
            setDeleteModalOpen(false);
            setJournalForDelete(null);
          }}
        />

        <ConfirmModal
          isOpen={lessonDeleteModalOpen}
          title="Видалення уроку"
          message={lessonForDelete ? `Видалити урок "${lessonForDelete.topic}"? Це видалить всі оцінки за цей урок.` : ""}
          confirmText="Видалити"
          cancelText="Скасувати"
          isDangerous
          isLoading={deletingLesson}
          onConfirm={confirmDeleteLesson}
          onCancel={() => {
            setLessonDeleteModalOpen(false);
            setLessonForDelete(null);
          }}
        />
      </div>
    </div>
  );
}