import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import $api from "../api/api";
import type { ApiResponse } from "../types/api.types";

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Пароль повинен містити мінімум 6 символів");
      return;
    }

    if (password !== confirmPassword) {
      setError("Паролі не співпадають");
      return;
    }

    try {
      setLoading(true);
      const response = await $api.post<ApiResponse<{ message: string }>>(
        `/auth/reset-password/${token}`,
        { password }
      );

      if (response.data.success) {
        setSuccess(true);
        setTimeout(() => {
          navigate("/auth");
        }, 3000);
      } else {
        setError(response.data.error || "Помилка встановлення пароля");
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.error || "Токен недійсний або закінчився термін дії"
      );
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
            <span className="text-green-600 text-2xl">✓</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Пароль встановлено!</h2>
          <p className="text-gray-600 mb-4">
            Ваш пароль успішно змінено. Перенаправляємо на сторінку входу...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Встановлення пароля</h1>
          <p className="text-gray-600">Dana School</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-gray-900 mb-2">
              Новий пароль
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Мінімум 6 символів"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-900 mb-2">
              Підтвердіть пароль
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Повторіть пароль"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-800 text-sm px-4 py-3 rounded">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-3 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Встановлення..." : "Встановити пароль"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => navigate("/auth")}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Повернутися до входу
          </button>
        </div>
      </div>
    </div>
  );
}
