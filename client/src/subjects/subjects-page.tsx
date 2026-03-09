import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import $api from "../api/api";
import type { ApiResponse } from "../types/api.types";
import type { Subject } from "../types/subject.types";
import authService from "../auth/auth-service";
import { ConfirmModal } from "../components/ConfirmModal";
import { BookOpen, RefreshCw, Search } from "lucide-react";

interface Teacher {
  _id: string;
  name: string;
  email: string;
  role?: string;
}

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", teacherId: "" });
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [subjectToDelete, setSubjectToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deletingSubject, setDeletingSubject] = useState(false);
  const isAdmin = authService.isAdmin();

  useEffect(() => {
    fetchSubjects();
    fetchTeachers();
  }, []);

  const fetchSubjects = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await $api.get<ApiResponse<Subject[]>>("/subjects");
      const resp = response.data;
      if (!resp.success) {
        setError(resp.error);
        return;
      }
      setSubjects(resp.data);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || "Не вдалося завантажити предмети");
    } finally {
      setLoading(false);
    }
  };

  const fetchTeachers = async () => {
    try {
      const response = await $api.get<ApiResponse<Teacher[]>>("/users");
      const resp = response.data;
      if (!resp.success) return;
      const teacherUsers = resp.data.filter((u) => u.role === "teacher");
      setTeachers(teacherUsers);
      if (teacherUsers.length && !form.teacherId) {
        setForm((prev) => ({ ...prev, teacherId: teacherUsers[0]._id }));
      }
    } catch (err) {
      // silently ignore; main errors shown via subject fetch
    }
  };

  const handleCreate = async (e: React.FormEvent): Promise<boolean> => {
    e.preventDefault();
    if (!isAdmin) {
      setError("Недостатньо прав для створення предмету");
      return false;
    }
    if (!form.name.trim()) {
      setError("Вкажіть назву предмету");
      return false;
    }

    try {
      setCreating(true);
      setError("");
      const payload: { name: string; teacherId?: string } = {
        name: form.name.trim(),
      };
      if (form.teacherId) {
        payload.teacherId = form.teacherId;
      }
      const response = await $api.post<ApiResponse<Subject>>("/subjects", payload);

      const resp = response.data;
      if (!resp.success) {
        setError(resp.error);
        return false;
      }

      setSubjects((prev) => [resp.data, ...prev]);
      setForm({ name: "", teacherId: form.teacherId });
      return true;
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || "Не вдалося створити предмет");
      return false;
    } finally {
      setCreating(false);
    }
  };

  const filteredSubjects = useMemo(() => {
    if (!query.trim()) return subjects;
    const q = query.trim().toLowerCase();
    return subjects.filter((subject) => {
      const teacherName = subject.teacher?.name?.toLowerCase() || "";
      return subject.name.toLowerCase().includes(q) || teacherName.includes(q);
    });
  }, [subjects, query]);

  const handleDeleteSubject = (id: string, name: string) => {
    if (!isAdmin) return;
    setSubjectToDelete({ id, name });
  };

  const confirmDeleteSubject = async () => {
    if (!subjectToDelete) return;

    try {
      setDeletingSubject(true);
      setError("");
      const response = await $api.delete<ApiResponse<{ id: string }>>(`/subjects/${subjectToDelete.id}`);
      const resp = response.data;
      if (!resp.success) {
        setError(resp.error || "Не вдалося видалити предмет");
        return;
      }
      setSubjects((prev) => prev.filter((subject) => subject.id !== subjectToDelete.id));
      setSubjectToDelete(null);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || "Не вдалося видалити предмет");
    } finally {
      setDeletingSubject(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-16 space-y-12">
        {/* Header Section */}
        <div className="space-y-8">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 text-white flex items-center justify-center shadow-xl shadow-blue-500/30">
                <BookOpen className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-gray-900">Предмети</h1>
                <p className="text-gray-600 text-base mt-1">Управління дисциплінами та викладачами</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <div className="relative flex-1 max-w-md">
                <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="input-field pl-12 w-full"
                  placeholder="Пошук за назвою чи викладачем..."
                />
              </div>
              <button
                onClick={fetchSubjects}
                className="btn-secondary inline-flex items-center gap-2 px-6"
                disabled={loading}
              >
                <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
                {loading ? "Оновлення..." : "Оновити"}
              </button>
              {isAdmin && (
                <button
                  onClick={() => {
                    setError("");
                    setCreateModalOpen(true);
                  }}
                  className="btn-primary inline-flex items-center gap-2 px-6"
                >
                  + Додати предмет
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Subjects List */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Усі дисципліни</h2>
              <p className="text-gray-600 text-sm mt-1">Показано {filteredSubjects.length} з {subjects.length}</p>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600 font-medium">Завантаження дисциплін...</p>
            </div>
          ) : subjects.length === 0 ? (
            <div className="card p-16 text-center shadow-md">
              <p className="text-gray-600 text-lg">Поки що немає доданих предметів</p>
              {isAdmin && <p className="text-gray-500 text-sm mt-2">Натисніть «Додати предмет», щоб створити перший</p>}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSubjects.map((subject) => (
                <Link
                  key={subject.id}
                  to={`/subjects/${subject.id}`}
                  className="card p-8 shadow-md hover:shadow-2xl hover:-translate-y-2 transition-all duration-200 group"
                >
                  <div className="space-y-5">
                    {/* Top Section */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                          {subject.name}
                        </h3>
                        <p className="text-gray-600 text-sm mt-2">
                          {subject.teacher?.name || "• Без викладача"}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        {isAdmin ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDeleteSubject(subject.id, subject.name);
                            }}
                            className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
                          >
                            Видалити
                          </button>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-300">
                            #{subject.id.slice(-3)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-gradient-to-r from-gray-200 to-transparent"></div>

                    {/* Bottom Section */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${subject.teacher?.email ? "bg-green-500" : "bg-gray-300"}`}></span>
                        <span className="text-xs font-medium text-gray-600">
                          {subject.teacher?.email ? "Закріплено" : "Без закріплення"}
                        </span>
                      </div>
                      <span className="text-blue-600 font-semibold text-sm group-hover:translate-x-1 transition-transform">
                        Переглянути →
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {isAdmin && createModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="Закрити"
              onClick={() => setCreateModalOpen(false)}
              className="absolute inset-0 bg-black/40"
            />
            <div className="relative w-full max-w-2xl card p-8 shadow-2xl z-10">
              <div className="flex items-start justify-between gap-6 mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Додати новий предмет</h2>
                  <p className="text-gray-600 mt-2">Вкажіть назву дисципліни та закріпіть викладача</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 p-2 rounded-lg transition-colors"
                  aria-label="Закрити меню"
                >
                  ✕
                </button>
              </div>

              {error && (
                <div className="bg-red-50 border-l-4 border-red-500 text-red-800 text-sm px-5 py-4 rounded mb-8 flex items-start gap-3">
                  <span className="text-red-500 text-xl">⚠</span>
                  <p>{error}</p>
                </div>
              )}

              <form
                onSubmit={async (e) => {
                  const created = await handleCreate(e);
                  if (created) {
                    setCreateModalOpen(false);
                  }
                }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-3">Назва предмету</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="напр. Математика"
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-3">Викладач</label>
                    <select
                      value={form.teacherId}
                      onChange={(e) => setForm((prev) => ({ ...prev, teacherId: e.target.value }))}
                      className="input-field"
                    >
                        <option value="">— Без викладача —</option>
                        {teachers.map((t) => (
                          <option key={t._id} value={t._id}>
                            {t.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="btn-secondary px-8 py-3"
                  >
                    Скасувати
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="btn-primary px-8 py-3 shadow-lg hover:shadow-xl transition-shadow"
                  >
                    {creating ? "Додавання..." : "Додати предмет"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <ConfirmModal
          isOpen={!!subjectToDelete}
          title="Видалення предмету"
          message={subjectToDelete ? `Ви точно хочете видалити предмет "${subjectToDelete.name}"? Це також видалить усі його журнали.` : ""}
          confirmText="Видалити"
          cancelText="Скасувати"
          isDangerous
          isLoading={deletingSubject}
          onConfirm={confirmDeleteSubject}
          onCancel={() => setSubjectToDelete(null)}
        />
      </div>
    </div>
  );
}
