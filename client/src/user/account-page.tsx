import { useEffect, useState } from "react";
import $api from "../api/api";
import authService from "../auth/auth-service";
import type { ApiResponse } from "../types/api.types";

interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: "student" | "teacher" | "admin";
  grade?: number;
  createdAt: string;
}

const roleLabel: Record<CurrentUser["role"], string> = {
  admin: "Адміністратор",
  teacher: "Викладач",
  student: "Учень",
};

export default function AccountPage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchCurrentUser = async () => {
      const userId = authService.getUserId();
      if (!userId) {
        setError("Не вдалося визначити поточного користувача");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        const response = await $api.get<ApiResponse<CurrentUser>>(`/users/${userId}`);

        if (response.data.success) {
          setUser(response.data.data);
        } else {
          setError(response.data.error || "Не вдалося завантажити обліковий запис");
        }
      } catch (err: any) {
        setError(err?.response?.data?.error || err.message || "Не вдалося завантажити обліковий запис");
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentUser();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <div className="flex flex-col items-center justify-center py-24">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600 font-medium">Завантаження облікового запису...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-3xl mx-auto px-6 py-16 space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-gray-900">Обліковий запис</h1>
          <p className="text-gray-600 text-lg">Інформація про поточний профіль користувача</p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-800 text-sm px-5 py-4 rounded flex items-start gap-3">
            <span className="text-red-500 text-xl">⚠</span>
            <p>{error}</p>
          </div>
        )}

        {user && (
          <div className="card shadow-lg overflow-hidden">
            <div className="divide-y divide-gray-200">
              <div className="px-6 py-5 bg-gray-50">
                <h2 className="text-xl font-semibold text-gray-900">Дані користувача</h2>
              </div>

              <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-6">
                <p className="text-sm font-semibold text-gray-500">Ім’я</p>
                <p className="sm:col-span-2 text-gray-900 font-medium">{user.name}</p>
              </div>

              <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-6">
                <p className="text-sm font-semibold text-gray-500">Email</p>
                <p className="sm:col-span-2 text-gray-900 font-medium">{user.email}</p>
              </div>

              <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-6">
                <p className="text-sm font-semibold text-gray-500">Роль</p>
                <p className="sm:col-span-2 text-gray-900 font-medium">{roleLabel[user.role] || user.role}</p>
              </div>

              {user.role === "student" && (
                <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-6">
                  <p className="text-sm font-semibold text-gray-500">Клас</p>
                  <p className="sm:col-span-2 text-gray-900 font-medium">
                    {user.grade !== undefined && user.grade !== null ? `${user.grade} клас` : "—"}
                  </p>
                </div>
              )}

              <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-6">
                <p className="text-sm font-semibold text-gray-500">Дата реєстрації</p>
                <p className="sm:col-span-2 text-gray-900 font-medium">
                  {new Date(user.createdAt).toLocaleDateString("uk-UA", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
