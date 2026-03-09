import { useEffect, useState } from "react";
import { Upload } from "lucide-react";
import $api from "../api/api";
import type { ApiResponse } from "../types/api.types";
import authService from "../auth/auth-service";
import StudentImportModal from "../components/StudentImportModal";
import { ConfirmModal } from "../components/ConfirmModal";

interface User {
  _id: string;
  name: string;
  email: string;
  role?: string;
  grade?: number;
  isArchived?: boolean;
  archivedAt?: string;
  createdAt: string;
}

interface RegistrationRequest {
  _id: string;
  name: string;
  email: string;
  requestedRole: string;
  createdAt: string;
}

export default function DashboardPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [reqLoading, setReqLoading] = useState(false);
  const [reqError, setReqError] = useState("");
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importSuccess, setImportSuccess] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const isAdmin = authService.isAdmin();

  const fetchUsers = async (includeArchived = showArchived) => {
    try {
      setLoading(true);
      setError("");
      const url = includeArchived ? "/users?includeArchived=true" : "/users";
      const response = await $api.get<ApiResponse<User[]>>(url);

      if (response.data.success) {
        setUsers(response.data.data);
      } else {
        setError(response.data.error);
      }
    } catch (err: any) {
      setError(err.message || "Не вдалося завантажити користувачів");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    if (isAdmin) fetchRequests();
  }, [isAdmin, showArchived]);

  const fetchRequests = async () => {
    try {
      setReqLoading(true);
      setReqError("");
      const response = await $api.get<ApiResponse<RegistrationRequest[]>>("/auth/requests");
      if (response.data.success) setRequests(response.data.data);
      else setReqError(response.data.error);
    } catch (err: any) {
      setReqError(err.message || "Не вдалося завантажити запити");
    } finally {
      setReqLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    if (!isAdmin) return;
    try {
      setReqLoading(true);
      await $api.post(`/auth/requests/${id}/approve`);
      setRequests((prev) => prev.filter((r) => r._id !== id));
      await fetchUsers();
    } catch (err: any) {
      setReqError(err?.response?.data?.error || err.message || "Не вдалося затвердити");
    } finally {
      setReqLoading(false);
    }
  };

  const handleDeleteRequest = async (id: string) => {
    if (!isAdmin) return;
    try {
      setReqLoading(true);
      await $api.delete(`/auth/requests/${id}`);
      setRequests((prev) => prev.filter((r) => r._id !== id));
    } catch (err: any) {
      setReqError(err?.response?.data?.error || err.message || "Не вдалося видалити");
    } finally {
      setReqLoading(false);
    }
  };

  const handleChangeRole = async (id: string, newRole: string) => {
    if (!isAdmin) return;
    try {
      await $api.patch(`/users/${id}/role`, { role: newRole });
      await fetchUsers();
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || "Не вдалося змінити роль");
    }
  };

  const handleChangeClass = async (id: string, grade: number) => {
    if (!isAdmin) return;
    try {
      await $api.patch(`/users/${id}/class`, { grade });
      await fetchUsers();
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || "Не вдалося змінити клас");
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!isAdmin) return;
    setUserToDelete(id);
    setDeleteModalOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      setDeleteLoading(true);
      await $api.delete(`/users/${userToDelete}`);
      setDeleteModalOpen(false);
      setUserToDelete(null);
      await fetchUsers();
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || "Не вдалося видалити учня");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleRestoreUser = async (id: string) => {
    if (!isAdmin) return;
    try {
      await $api.patch(`/users/${id}/restore`);
      await fetchUsers();
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || "Не вдалося відновити користувача");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-16 space-y-12">
        {/* Header */}
        <div className="flex items-start justify-between gap-6 flex-col lg:flex-row">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-gray-900">Управління користувачами</h1>
            <p className="text-gray-600 text-lg">Перегляд та редагування облікових записів користувачів</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
            >
              <Upload className="w-5 h-5" />
              Імпортувати учнів
            </button>
          )}
        </div>

        {/* Import Success Message */}
        {importSuccess && (
          <div className="bg-green-50 border-l-4 border-green-500 text-green-800 text-sm px-5 py-4 rounded flex items-start gap-3">
            <span className="text-green-500 text-xl">✓</span>
            <p>{importSuccess}</p>
          </div>
        )}

        {/* Users Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Користувачі системи</h2>
            <div className="flex items-center gap-4">
              {isAdmin && (
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={(e) => setShowArchived(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Показувати архівних
                </label>
              )}
              <span className="px-4 py-2 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold">
                {users.length} {users.length === 1 ? "користувач" : "користувачів"}
              </span>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-800 text-sm px-5 py-4 rounded flex items-start gap-3">
              <span className="text-red-500 text-xl">⚠</span>
              <p>{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600 font-medium">Завантаження користувачів...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="card p-16 text-center shadow-md">
              <p className="text-gray-600 text-lg">Немає зареєстрованих користувачів</p>
            </div>
          ) : (
            <div className="card shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-6 py-4 text-left font-semibold text-gray-900">Ім'я</th>
                      <th className="px-6 py-4 text-left font-semibold text-gray-900">Email</th>
                      <th className="px-6 py-4 text-left font-semibold text-gray-900">Роль</th>
                      <th className="px-6 py-4 text-left font-semibold text-gray-900">Клас</th>
                      <th className="px-6 py-4 text-left font-semibold text-gray-900">Дата реєстрації</th>
                      {isAdmin && (
                        <th className="px-6 py-4 text-left font-semibold text-gray-900">Дії</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user, idx) => (
                      <tr
                        key={user._id}
                        className={`border-b border-gray-200 hover:bg-blue-50 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} ${user.isArchived ? "opacity-60" : ""}`}
                      >
                        <td className="px-6 py-4 font-medium text-gray-900">
                          {user.name}
                          {user.isArchived && (
                            <span className="ml-2 inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-200 text-gray-700">
                              Архів
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-600 font-mono text-sm">{user.email}</td>
                        <td className="px-6 py-4">
                          {user.role === "admin" ? (
                            <span className="inline-flex px-3 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-700">
                              Адміністратор
                            </span>
                          ) : isAdmin && !user.isArchived ? (
                            <select
                              value={user.role || "student"}
                              onChange={(e) => handleChangeRole(user._id, e.target.value)}
                              className="input-field py-2 text-sm"
                            >
                              <option value="student">Учень</option>
                              <option value="teacher">Викладач</option>
                            </select>
                          ) : (
                            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700">
                              {user.role === "teacher" ? "Викладач" : "Учень"}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {user.role === "student" ? (
                            isAdmin && !user.isArchived ? (
                              <select
                                value={user.grade ?? 0}
                                onChange={(e) => handleChangeClass(user._id, Number(e.target.value))}
                                className="input-field py-2 text-sm"
                              >
                                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((g) => (
                                  <option key={g} value={g}>
                                    {g} клас
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-gray-500">{user.grade !== undefined && user.grade !== null ? `${user.grade} клас` : "—"}</span>
                            )
                          ) : (
                            <span className="text-gray-500">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {new Date(user.createdAt).toLocaleDateString("uk-UA", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        {isAdmin && (
                          <td className="px-6 py-4">
                            {user.isArchived ? (
                              <button
                                onClick={() => handleRestoreUser(user._id)}
                                className="px-2 py-1 text-xs font-medium text-green-700 hover:text-green-800 hover:bg-green-50 rounded transition-colors"
                              >
                                ⟲
                              </button>
                            ) : (user.role === "student" || user.role === "teacher") ? (
                              <button
                                onClick={() => handleDeleteUser(user._id)}
                                className="px-2 py-1 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                              >
                                ✕
                              </button>
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Registration Requests */}
        {isAdmin && (
          <div className="space-y-6 border-t border-gray-200 pt-12">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Запити на реєстрацію</h2>
              <button
                onClick={fetchRequests}
                className="btn-secondary px-6"
                disabled={reqLoading}
              >
                {reqLoading ? "Оновлення..." : "Оновити"}
              </button>
            </div>

            {reqError && (
              <div className="bg-red-50 border-l-4 border-red-500 text-red-800 text-sm px-5 py-4 rounded flex items-start gap-3">
                <span className="text-red-500 text-xl">⚠</span>
                <p>{reqError}</p>
              </div>
            )}

            {reqLoading && requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-600 font-medium">Завантаження запитів...</p>
              </div>
            ) : requests.length === 0 ? (
              <div className="card p-16 text-center shadow-md">
                <p className="text-gray-600 text-lg">Немає очікуючих запитів</p>
              </div>
            ) : (
              <div className="card shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="px-6 py-4 text-left font-semibold text-gray-900">Ім'я</th>
                        <th className="px-6 py-4 text-left font-semibold text-gray-900">Email</th>
                        <th className="px-6 py-4 text-left font-semibold text-gray-900">Запитує роль</th>
                        <th className="px-6 py-4 text-left font-semibold text-gray-900">Дата запиту</th>
                        <th className="px-6 py-4 text-left font-semibold text-gray-900">Дії</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requests.map((req, idx) => (
                        <tr key={req._id} className={`border-b border-gray-200 hover:bg-blue-50 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                          <td className="px-6 py-4 font-medium text-gray-900">{req.name}</td>
                          <td className="px-6 py-4 text-gray-600 font-mono text-sm">{req.email}</td>
                          <td className="px-6 py-4">
                            <span className="inline-flex px-3 py-1 text-xs font-bold rounded-full bg-yellow-100 text-yellow-700">
                              {req.requestedRole === "teacher" ? "Викладач" : "Учень"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-600">
                            {new Date(req.createdAt).toLocaleDateString("uk-UA", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleApprove(req._id)}
                                className="px-3 py-1.5 text-xs font-bold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                                disabled={reqLoading}
                              >
                                ✓ Затвердити
                              </button>
                              <button
                                onClick={() => handleDeleteRequest(req._id)}
                                className="px-3 py-1.5 text-xs font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                                disabled={reqLoading}
                              >
                                ✕ Відхилити
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Import Modal */}
        <StudentImportModal
          isOpen={isImportModalOpen}
          onClose={() => {
            setIsImportModalOpen(false);
            setImportSuccess("");
          }}
          onSuccess={(result) => {
            setImportSuccess(`Успішно імпортовано ${result.created} учнів!`);
            // Refresh users list
            fetchUsers();
            setTimeout(() => setIsImportModalOpen(false), 1500);
          }}
        />

        {/* Delete User Confirmation Modal */}
        <ConfirmModal
          isOpen={deleteModalOpen}
          title="Архівування користувача"
          message="Ви впевнені? Користувача буде архівовано і його можна буде відновити."
          confirmText="Архівувати"
          cancelText="Скасувати"
          isDangerous
          isLoading={deleteLoading}
          onConfirm={confirmDeleteUser}
          onCancel={() => {
            setDeleteModalOpen(false);
            setUserToDelete(null);
          }}
        />
      </div>
    </div>
  );
}
