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

interface TopicMatch {
  lessonDate: string;
  topic: string;
  subjectId: string;
  subjectName: string;
  materialTitle: string | null;
  snippet: string;
  score: number;
}

interface TopicExplanation {
  lessonDate: string;
  topic: string;
  subjectId: string;
  subjectName: string;
  materialTitle: string | null;
  explanation: string;
  usedExternalKnowledge: boolean;
  cached: boolean;
}

type GenerationStage = "idle" | "collecting" | "matching" | "generating" | "podcast" | "finalizing";

function formatFullDate(date: string) {
  return new Date(date).toLocaleDateString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function StudentGenerationPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [skippedLessons, setSkippedLessons] = useState<SkippedLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [explanations, setExplanations] = useState<TopicExplanation[]>([]);
  const [generationStage, setGenerationStage] = useState<GenerationStage>("idle");
  const [generationProgress, setGenerationProgress] = useState(0);
  const [podcastUrl, setPodcastUrl] = useState("");
  const [podcastFileName, setPodcastFileName] = useState("podcast.mp3");
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (podcastUrl) {
        URL.revokeObjectURL(podcastUrl);
      }
    };
  }, [podcastUrl]);

  useEffect(() => {
    if (!generating) return;

    const stageTargets: Record<GenerationStage, number> = {
      idle: 0,
      collecting: 24,
      matching: 52,
      generating: 76,
      podcast: 90,
      finalizing: 98,
    };

    const target = stageTargets[generationStage] ?? 0;
    const timer = window.setInterval(() => {
      setGenerationProgress((prev) => {
        if (prev >= target) return prev;
        const step = target - prev > 16 ? 3 : 1;
        return Math.min(prev + step, target);
      });
    }, 45);

    return () => window.clearInterval(timer);
  }, [generating, generationStage]);

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
    if (!selectedSubjectId) return [];
    return skippedLessons.filter((lesson) => lesson.subjectId === selectedSubjectId);
  }, [selectedSubjectId, skippedLessons]);

  const generateAll = async () => {
    try {
      setGenerating(true);
      setGenerationStage("collecting");
      setGenerationProgress(6);
      setError("");

      const topicsPayload = visibleLessons.map((lesson) => ({
        subjectId: lesson.subjectId,
        subjectName: lesson.subjectName,
        date: lesson.date,
        topic: lesson.topic,
      }));

      setGenerationStage("matching");

      const matchesResponse = await $api.post<ApiResponse<TopicMatch[]>>("/generation/topic-matches", {
        missedLessons: topicsPayload,
      });

      if (!matchesResponse.data.success) {
        setError(matchesResponse.data.error || "Не вдалося підготувати матеріали для генерації");
        return;
      }

      const foundMatches = matchesResponse.data.data || [];
      if (foundMatches.length === 0) {
        setExplanations([]);
        if (podcastUrl) {
          URL.revokeObjectURL(podcastUrl);
          setPodcastUrl("");
        }
        setError("Не знайдено даних для генерації по вибраному предмету");
        return;
      }

      setGenerationStage("generating");

      const explanationsResponse = await $api.post<ApiResponse<TopicExplanation[]>>("/generation/explanations", {
        items: foundMatches.map((item) => ({
          lessonDate: item.lessonDate,
          topic: item.topic,
          subjectId: item.subjectId,
          subjectName: item.subjectName,
          materialTitle: item.materialTitle,
          snippet: item.snippet,
          score: item.score,
        })),
      });

      if (!explanationsResponse.data.success) {
        setError(explanationsResponse.data.error || "Не вдалося згенерувати пояснення");
        return;
      }

      if (podcastUrl) {
        URL.revokeObjectURL(podcastUrl);
        setPodcastUrl("");
      }

      const generatedExplanations = explanationsResponse.data.data || [];
      setExplanations(generatedExplanations);

      setGenerationStage("podcast");
      try {
        const selectedSubject = subjects.find((subject) => subject.id === selectedSubjectId);
        const podcastResponse = await $api.post(
          "/generation/podcast",
          {
            subjectId: selectedSubjectId,
            subjectName: selectedSubject?.name || "Предмет",
            items: generatedExplanations.map((item) => ({
              lessonDate: item.lessonDate,
              topic: item.topic,
              explanation: item.explanation,
            })),
          },
          { responseType: "blob" }
        );

        const contentDisposition = podcastResponse.headers?.["content-disposition"] as string | undefined;
        const match = contentDisposition?.match(/filename=\"?([^\";]+)\"?/i);
        const nextFileName = (match?.[1] || "podcast.mp3").trim();

        const objectUrl = URL.createObjectURL(podcastResponse.data as Blob);
        setPodcastUrl(objectUrl);
        setPodcastFileName(nextFileName || "podcast.mp3");
      } catch {
        setError("Пояснення згенеровано, але не вдалося створити подкаст");
      }

      setGenerationStage("finalizing");
      setGenerationProgress(100);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || "Не вдалося згенерувати пояснення");
    } finally {
      setGenerating(false);
      setGenerationStage("idle");
    }
  };

  const stageText: Record<GenerationStage, string> = {
    idle: "",
    collecting: "Збір інформації з матеріалів...",
    matching: "Пошук релевантних фрагментів...",
    generating: "Генерація відповіді AI...",
    podcast: "Генерація подкасту...",
    finalizing: "Фінальне оформлення результату...",
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-16 space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-gray-900">Генерація</h1>
          <p className="text-gray-600 text-lg">Обери предмет, переглянь пропущені теми і згенеруй пояснення</p>
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
              onChange={(e) => {
                setSelectedSubjectId(e.target.value);
                setExplanations([]);
                setGenerationStage("idle");
                setGenerationProgress(0);
                if (podcastUrl) {
                  URL.revokeObjectURL(podcastUrl);
                  setPodcastUrl("");
                }
              }}
              className="input-field min-w-[240px]"
              disabled={loading}
            >
              <option value="">Оберіть предмет...</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>

          <div className="text-sm text-gray-600">
            {selectedSubjectId ? (
              <>
                Пропущених уроків: <span className="font-bold text-gray-900">{visibleLessons.length}</span>
              </>
            ) : (
              <>Оберіть предмет, щоб продовжити</>
            )}
          </div>
        </div>

        {selectedSubjectId && (
          <>
            <div className="card p-6 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Пропущені теми</h2>
                <span className="text-sm text-gray-500">{visibleLessons.length} тема(и)</span>
              </div>

              {loading ? (
                <div className="text-sm text-gray-600">Завантаження...</div>
              ) : visibleLessons.length === 0 ? (
                <div className="text-sm text-gray-600">Для обраного предмета немає пропущених тем.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-gray-500 uppercase tracking-wide text-xs">
                        <th className="py-3 pr-4">Дата</th>
                        <th className="py-3 pr-4">Клас</th>
                        <th className="py-3">Тема</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleLessons.map((lesson) => (
                        <tr key={lesson.key} className="border-b border-gray-100 last:border-b-0">
                          <td className="py-3 pr-4 text-gray-800 whitespace-nowrap">{formatFullDate(lesson.date)}</td>
                          <td className="py-3 pr-4 text-gray-700">{lesson.grade}</td>
                          <td className="py-3 text-gray-700">{lesson.topic || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="card p-6 shadow-lg">
              <button
                onClick={generateAll}
                disabled={loading || generating || visibleLessons.length === 0}
                className="w-full py-4 rounded-xl bg-emerald-600 text-white text-lg font-bold hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {generating ? "Генерація..." : "Згенерувати пояснення"}
              </button>
            </div>

            <div className="card p-6 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Результат генерації</h2>
                <span className="text-sm text-gray-500">{explanations.length} результат(ів)</span>
              </div>

              {generating ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse"></div>
                      <p className="text-sm font-medium text-gray-700">{stageText[generationStage]}</p>
                    </div>

                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 transition-all duration-300"
                        style={{ width: `${Math.max(6, generationProgress)}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                      <div className={`px-3 py-2 rounded-md border ${generationProgress >= 24 ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-gray-50 border-gray-200 text-gray-500"}`}>
                        1. Збір матеріалів
                      </div>
                      <div className={`px-3 py-2 rounded-md border ${generationProgress >= 52 ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-gray-50 border-gray-200 text-gray-500"}`}>
                        2. Аналіз тем
                      </div>
                      <div className={`px-3 py-2 rounded-md border ${generationProgress >= 76 ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-gray-50 border-gray-200 text-gray-500"}`}>
                        3. Генерація відповіді
                      </div>
                      <div className={`px-3 py-2 rounded-md border ${generationProgress >= 90 ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-gray-50 border-gray-200 text-gray-500"}`}>
                        4. Генерація подкасту
                      </div>
                    </div>
                  </div>
              ) : explanations.length === 0 ? (
                <div className="text-sm text-gray-600">Після генерації тут з'являться пояснення.</div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg border border-cyan-200 bg-cyan-50/40 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <p className="text-sm font-semibold text-cyan-900">Подкаст за згенерованими поясненнями</p>
                      <div className="flex items-center gap-2">
                        {podcastUrl && (
                          <a
                            href={podcastUrl}
                            download={podcastFileName}
                            className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800"
                          >
                            Завантажити mp3
                          </a>
                        )}
                      </div>
                    </div>

                    {podcastUrl && (
                      <audio controls className="w-full">
                        <source src={podcastUrl} type="audio/mpeg" />
                      </audio>
                    )}
                  </div>

                  {explanations.map((item, index) => (
                    <div key={`${item.subjectId}-${item.lessonDate}-${item.topic}-${index}`} className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/30">
                      <div className="flex flex-wrap items-center gap-2 text-sm mb-2">
                        <span className="font-semibold text-gray-900">{item.subjectName}</span>
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-700">{item.topic}</span>
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-500">{formatFullDate(item.lessonDate)}</span>
                      </div>
                      <p className="text-sm font-medium text-emerald-900 mb-2">
                        {item.materialTitle ? `Матеріал: ${item.materialTitle}` : "Матеріал не вказано"}
                      </p>
                      <div className="mb-2 flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${item.cached ? "bg-gray-200 text-gray-700" : "bg-emerald-200 text-emerald-800"}`}>
                          {item.cached ? "З кешу" : "Нове"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-800 whitespace-pre-line">{item.explanation}</p>
                      {item.usedExternalKnowledge && (
                        <p className="mt-3 text-xs text-amber-700">
                          Використано додаткові загальні знання для доповнення матеріалу (відповідно до шкільного рівня НУШ).
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
