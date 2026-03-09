import { useEffect, useMemo, useState } from "react";
import $api from "../api/api";
import type { ApiResponse } from "../types/api.types";
import type { PerformancePoint, SubjectOption } from "../types/analytics.types";
import authService from "../auth/auth-service";
import PerformanceCharts from "../components/PerformanceCharts";

export default function StudentAnalyticsPage() {
  const [marks, setMarks] = useState<PerformancePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        setError("");

        const userId = authService.getUserId();
        if (!userId) {
          setError("Користувача не знайдено");
          return;
        }

        const response = await $api.get<ApiResponse<PerformancePoint[]>>(`/users/${userId}/performance`);

        if (!response.data.success) {
          setError(response.data.error || "Не вдалося завантажити аналітику");
          return;
        }

        setMarks(response.data.data || []);
      } catch (err: any) {
        setError(err?.response?.data?.error || err.message || "Не вдалося завантажити аналітику");
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

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
          <h1 className="text-4xl font-bold text-gray-900">Аналітика успішності</h1>
          <p className="text-gray-600 text-lg">Графік ваших оцінок з можливістю фільтрації за предметом</p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-800 text-sm px-5 py-4 rounded flex items-start gap-3">
            <span className="text-red-500 text-xl">⚠</span>
            <p>{error}</p>
          </div>
        )}

        <PerformanceCharts marks={marks} subjects={subjects} loading={loading} />
      </div>
    </div>
  );
}
