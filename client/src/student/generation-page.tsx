import { useEffect, useMemo, useState } from "react";
import $api from "../api/api";
import authService from "../auth/auth-service";
import type { ApiResponse } from "../types/api.types";
import type { Subject, SubjectDetail } from "../types/subject.types";

interface SkippedLesson {
  key: string;
  subjectId: string;
  subjectName: string;
  grade: number;
  date: string;
  topic: string;
}

function formatFullDate(date: string) {
  return new Date(date).toLocaleDateString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function StudentGenerationPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState("all");
  const [skippedLessons, setSkippedLessons] = useState<SkippedLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchSkippedLessons = async () => {
      try {
        setLoading(true);
        setError("");

        const subjectsResponse = await $api.get<ApiResponse<Subject[]>>("/subjects");
        if (!subjectsResponse.data.success) {
          setError(subjectsResponse.data.error || "Не вдалося завантажити предмети");
          return;
        }

        const studentSubjects = subjectsResponse.data.data || [];
        setSubjects(studentSubjects);

        const details = await Promise.all(
          studentSubjects.map(async (subject) => {
            const detailResponse = await $api.get<ApiResponse<SubjectDetail>>(`/subjects/${subject.id}`);
            return {
              subject,
              detail: detailResponse.data.success ? detailResponse.data.data : null,
            };
          })
        );

        const userId = authService.getUserId();
        const extracted: SkippedLesson[] = [];

        details.forEach(({ subject, detail }) => {
          if (!detail) return;

          (detail.journals || []).forEach((journal) => {
            (journal.lessons || []).forEach((lesson) => {
              const ownMark = userId
                ? (lesson.marks || []).find((mark) => mark.student.id === userId)
                : (lesson.marks || [])[0];

              if (!ownMark?.isAbsent) return;

              extracted.push({
                key: `${subject.id}-${journal.id}-${lesson.id}`,
                subjectId: subject.id,
                subjectName: subject.name,
                grade: journal.grade,
                date: lesson.date,
                topic: lesson.topic,
              });
            });
          });
        });

        extracted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setSkippedLessons(extracted);
      } catch (err: any) {
        setError(err?.response?.data?.error || err.message || "Не вдалося завантажити пропущені уроки");
      } finally {
        setLoading(false);
      }
    };

    fetchSkippedLessons();
  }, []);

  const visibleLessons = useMemo(() => {
    if (selectedSubjectId === "all") return skippedLessons;
    return skippedLessons.filter((lesson) => lesson.subjectId === selectedSubjectId);
  }, [selectedSubjectId, skippedLessons]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-16 space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-gray-900">Генерація</h1>
          <p className="text-gray-600 text-lg">Перший крок: зібрані ваші пропущені уроки з обліку відвідування</p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-800 text-sm px-5 py-4 rounded flex items-start gap-3">
            <span className="text-red-500 text-xl">!</span>
            <p>{error}</p>
          </div>
        )}

        <div className="card p-6 shadow-lg flex flex-col sm:flex-row gap-4 sm:items-end sm:justify-between">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Предмет</label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="input-field min-w-[240px]"
              disabled={loading}
            >
              <option value="all">Всі предмети</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>

          <div className="text-sm text-gray-600">
            Пропущених уроків: <span className="font-bold text-gray-900">{visibleLessons.length}</span>
          </div>
        </div>

        <div className="card p-6 shadow-lg">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600 font-medium">Завантаження пропущених уроків...</p>
            </div>
          ) : visibleLessons.length === 0 ? (
            <div className="text-center py-16 text-gray-600">Немає пропущених уроків для відображення</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500 uppercase tracking-wide text-xs">
                    <th className="py-3 pr-4">Дата</th>
                    <th className="py-3 pr-4">Предмет</th>
                    <th className="py-3 pr-4">Клас</th>
                    <th className="py-3">Тема уроку</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLessons.map((lesson) => (
                    <tr key={lesson.key} className="border-b border-gray-100 last:border-b-0">
                      <td className="py-3 pr-4 text-gray-800 whitespace-nowrap">{formatFullDate(lesson.date)}</td>
                      <td className="py-3 pr-4 text-gray-900 font-medium">{lesson.subjectName}</td>
                      <td className="py-3 pr-4 text-gray-700">{lesson.grade}</td>
                      <td className="py-3 text-gray-700">{lesson.topic || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
