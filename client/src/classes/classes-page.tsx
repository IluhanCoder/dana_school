import { useEffect, useState } from "react";
import $api from "../api/api";
import type { ApiResponse } from "../types/api.types";
import type { Class } from "../types/class.types";
import authService from "../auth/auth-service";
import { ConfirmModal } from "../components/ConfirmModal";

interface Teacher {
  _id: string;
  name: string;
  email: string;
}

export default function ClassesPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedClass, setExpandedClass] = useState<number | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<Record<number, string>>({});
  const [savingClass, setSavingClass] = useState<number | null>(null);
  const [removeModalOpen, setRemoveModalOpen] = useState(false);
  const [classToRemove, setClassToRemove] = useState<number | null>(null);
  const [removingClass, setRemovingClass] = useState(false);
  const isAdmin = authService.isAdmin();

  useEffect(() => {
    fetchClasses();
    if (isAdmin) {
      fetchTeachers();
    }
  }, [isAdmin]);

  const fetchClasses = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await $api.get<ApiResponse<Class[]>>("/grades");
      if (response.data.success) {
        setClasses(response.data.data);
        // Initialize selected teachers
        const initial: Record<number, string> = {};
        response.data.data.forEach((cls) => {
          if (cls.formTeacher?.id) {
            initial[cls.grade] = cls.formTeacher.id;
          }
        });
        setSelectedTeacher(initial);
      } else {
        setError(response.data.error);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || "Failed to load grades");
    } finally {
      setLoading(false);
    }
  };

  const fetchTeachers = async () => {
    try {
      const response = await $api.get<ApiResponse<Teacher[]>>("/users?role=teacher&includeArchived=false");
      if (response.data.success) {
        setTeachers(response.data.data as Teacher[]);
      }
    } catch (err: any) {
      console.error("Failed to fetch teachers:", err);
    }
  };

  const handleSetFormTeacher = async (grade: number) => {
    if (!isAdmin) return;
    const teacherId = selectedTeacher[grade];
    if (!teacherId) {
      setError("Please select a teacher");
      return;
    }

    try {
      setSavingClass(grade);
      setError("");
      await $api.patch(`/grades/${grade}/form-teacher`, { teacherId });
      await fetchClasses();
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || "Failed to set form teacher");
    } finally {
      setSavingClass(null);
    }
  };

  const handleRemoveFormTeacher = async () => {
    if (!classToRemove || !isAdmin) return;

    try {
      setRemovingClass(true);
      setError("");
      await $api.delete(`/grades/${classToRemove}/form-teacher`);
      setRemoveModalOpen(false);
      setClassToRemove(null);
      await fetchClasses();
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || "Failed to remove form teacher");
    } finally {
      setRemovingClass(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 mt-4">Завантаження класів...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12 space-y-3">
          <h1 className="text-4xl font-bold text-gray-900">Класи</h1>
          <p className="text-gray-600 text-lg">Перегляд інформації про класи та управління класними керівниками</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 text-red-800 text-sm px-4 py-3 rounded flex items-start gap-3">
            <span className="text-red-500 text-xl">⚠</span>
            <p>{error}</p>
          </div>
        )}

        {/* Classes List */}
        <div className="space-y-4">
          {classes.length === 0 ? (
            <div className="card p-8 text-center shadow-md">
              <p className="text-gray-600">Немає класів</p>
            </div>
          ) : (
            classes.map((cls) => (
              <div
                key={cls.grade}
                className="card shadow-md overflow-hidden transition-all hover:shadow-lg"
              >
                {/* Class Header */}
                <button
                  onClick={() =>
                    setExpandedClass(expandedClass === cls.grade ? null : cls.grade)
                  }
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1 text-left">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                      <span className="text-white font-bold text-lg">{cls.grade}</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {cls.grade} клас
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {cls.studentCount} учнів
                        {cls.formTeacher && (
                          <span className="ml-3">
                            • Керівник: <span className="font-medium">{cls.formTeacher.name}</span>
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-2xl transition-transform" style={{
                    transform: expandedClass === cls.grade ? "rotate(180deg)" : "rotate(0deg)",
                  }}>
                    ▼
                  </div>
                </button>

                {/* Expanded Content */}
                {expandedClass === cls.grade && (
                  <div className="border-t border-gray-200 bg-gray-50 px-6 py-6 space-y-6">
                    {/* Form Teacher Section */}
                    {isAdmin && (
                      <div className="space-y-4">
                        <h4 className="font-semibold text-gray-900">Класний керівник</h4>
                        <div className="flex items-end gap-3">
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Виберіть керівника
                            </label>
                            <select
                              value={selectedTeacher[cls.grade] || ""}
                              onChange={(e) =>
                                setSelectedTeacher({
                                  ...selectedTeacher,
                                  [cls.grade]: e.target.value,
                                })
                              }
                              className="input-field w-full"
                            >
                              <option value="">— Немає керівника —</option>
                              {teachers.map((t) => (
                                <option key={t._id} value={t._id}>
                                  {t.name} ({t.email})
                                </option>
                              ))}
                            </select>
                          </div>
                          <button
                            onClick={() => handleSetFormTeacher(cls.grade)}
                            disabled={savingClass === cls.grade}
                            className="btn-primary px-6 py-2"
                          >
                            {savingClass === cls.grade ? "..." : "Зберегти"}
                          </button>
                          {cls.formTeacher && (
                            <button
                              onClick={() => {
                                setClassToRemove(cls.grade);
                                setRemoveModalOpen(true);
                              }}
                              className="px-4 py-2 rounded bg-red-100 hover:bg-red-200 text-red-700 font-medium transition-colors"
                            >
                              Видалити
                            </button>
                          )}
                        </div>
                        {cls.formTeacher && (
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-900">
                            Поточний керівник: <span className="font-semibold">{cls.formTeacher.name}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Students List */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-900">Учні ({cls.studentCount})</h4>
                      <div className="max-h-60 overflow-y-auto space-y-2">
                        {/* We could fetch and display students here later */}
                        <p className="text-sm text-gray-600">Завантажите клас щоб побачити учнів</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Remove Form Teacher Modal */}
      <ConfirmModal
        isOpen={removeModalOpen}
        title="Видалення класного керівника"
        message={classToRemove ? `Ви впевнені? Класний керівник буде видалено з ${classToRemove} класу.` : ""}
        confirmText="Видалити"
        cancelText="Скасувати"
        isDangerous
        isLoading={removingClass}
        onConfirm={handleRemoveFormTeacher}
        onCancel={() => {
          setRemoveModalOpen(false);
          setClassToRemove(null);
        }}
      />
    </div>
  );
}
