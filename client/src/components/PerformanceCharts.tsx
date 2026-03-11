import { useEffect, useMemo, useState } from "react";
import type { PerformancePoint, SubjectOption } from "../types/analytics.types";

interface DailyAveragePoint {
  date: string;
  value: number;
  count: number;
}

interface MonthlyAveragePoint {
  month: string;
  value: number;
  count: number;
  serial: number;
}

interface ChartPoint {
  label: string;
  value: number;
}

interface PerformanceChartsProps {
  marks: PerformancePoint[];
  subjects: SubjectOption[];
  loading: boolean;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
  });
}

function formatMonthLabel(month: string) {
  const [year, monthNum] = month.split("-").map(Number);
  return new Date(year, (monthNum || 1) - 1, 1).toLocaleDateString("uk-UA", {
    month: "short",
    year: "2-digit",
  });
}

function buildPath(points: Array<{ x: number; y: number }>): string {
  if (!points.length) return "";
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

const DAY_MS = 1000 * 60 * 60 * 24;

export default function PerformanceCharts({ marks, subjects, loading }: PerformanceChartsProps) {
  const [selectedSubjectId, setSelectedSubjectId] = useState("all");
  const [averageByMonth, setAverageByMonth] = useState(false);

  useEffect(() => {
    if (selectedSubjectId === "all") return;
    const stillExists = subjects.some((subject) => subject.id === selectedSubjectId);
    if (!stillExists) {
      setSelectedSubjectId("all");
    }
  }, [selectedSubjectId, subjects]);

  const filteredMarks = useMemo(() => {
    if (selectedSubjectId === "all") return marks;
    return marks.filter((mark) => mark.subjectId === selectedSubjectId);
  }, [marks, selectedSubjectId]);

  const averageMark = useMemo(() => {
    if (!filteredMarks.length) return null;
    const sum = filteredMarks.reduce((acc, item) => acc + item.value, 0);
    return Number((sum / filteredMarks.length).toFixed(2));
  }, [filteredMarks]);

  const dailyAverages = useMemo<DailyAveragePoint[]>(() => {
    const grouped = new Map<string, { sum: number; count: number; ts: number }>();

    filteredMarks.forEach((mark) => {
      const dateObj = new Date(mark.date);
      const dayKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}`;
      const existing = grouped.get(dayKey);
      if (existing) {
        grouped.set(dayKey, { ...existing, sum: existing.sum + mark.value, count: existing.count + 1 });
      } else {
        const dayTs = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()).getTime();
        grouped.set(dayKey, { sum: mark.value, count: 1, ts: dayTs });
      }
    });

    return Array.from(grouped.entries())
      .sort((a, b) => a[1].ts - b[1].ts)
      .map(([date, item]) => ({
        date,
        value: Number((item.sum / item.count).toFixed(2)),
        count: item.count,
      }));
  }, [filteredMarks]);

  const monthlyAverages = useMemo<MonthlyAveragePoint[]>(() => {
    const grouped = new Map<string, { sum: number; count: number; ts: number }>();

    filteredMarks.forEach((mark) => {
      const dateObj = new Date(mark.date);
      const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}`;
      const existing = grouped.get(monthKey);
      if (existing) {
        grouped.set(monthKey, { ...existing, sum: existing.sum + mark.value, count: existing.count + 1 });
      } else {
        const monthTs = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1).getTime();
        grouped.set(monthKey, { sum: mark.value, count: 1, ts: monthTs });
      }
    });

    return Array.from(grouped.entries())
      .sort((a, b) => a[1].ts - b[1].ts)
      .map(([month, item]) => ({
        month,
        value: Number((item.sum / item.count).toFixed(2)),
        count: item.count,
        serial: Math.floor(item.ts / (1000 * 60 * 60 * 24 * 30)),
      }));
  }, [filteredMarks]);

  const dailySeriesForRegression = useMemo(() => {
    if (!dailyAverages.length) return [] as Array<{ x: number; y: number; ts: number }>;

    const sorted = [...dailyAverages].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const baseTs = new Date(sorted[0].date).getTime();
    const points: Array<{ x: number; y: number; ts: number }> = [];

    for (let i = 0; i < sorted.length; i++) {
      const currentTs = new Date(sorted[i].date).getTime();
      const currentY = sorted[i].value;

      points.push({
        x: (currentTs - baseTs) / DAY_MS,
        y: currentY,
        ts: currentTs,
      });

      if (i === sorted.length - 1) continue;

      const nextTs = new Date(sorted[i + 1].date).getTime();
      const nextY = sorted[i + 1].value;
      const gapDays = Math.round((nextTs - currentTs) / DAY_MS);

      if (gapDays <= 1) continue;

      // Fill missing days with linear interpolation for smoother regression.
      for (let dayOffset = 1; dayOffset < gapDays; dayOffset++) {
        const ratio = dayOffset / gapDays;
        const ts = currentTs + dayOffset * DAY_MS;
        const y = currentY + (nextY - currentY) * ratio;

        points.push({
          x: (ts - baseTs) / DAY_MS,
          y,
          ts,
        });
      }
    }

    return points.sort((a, b) => a.ts - b.ts);
  }, [dailyAverages]);

  const forecastData = useMemo<ChartPoint[]>(() => {
    if (!dailySeriesForRegression.length) return [];

    const points = dailySeriesForRegression.map((item) => ({ x: item.x, y: item.y }));

    const n = points.length;
    const avgY = points.reduce((sum, point) => sum + point.y, 0) / n;

    let slope = 0;
    let intercept = avgY;

    if (n >= 2) {
      const sumX = points.reduce((sum, point) => sum + point.x, 0);
      const sumY = points.reduce((sum, point) => sum + point.y, 0);
      const sumXY = points.reduce((sum, point) => sum + point.x * point.y, 0);
      const sumXX = points.reduce((sum, point) => sum + point.x * point.x, 0);
      const denominator = n * sumXX - sumX * sumX;

      if (denominator !== 0) {
        slope = (n * sumXY - sumX * sumY) / denominator;
        intercept = (sumY - slope * sumX) / n;
      }
    }

    const firstTs = dailySeriesForRegression[0].ts;
    const lastKnownTs = dailySeriesForRegression[dailySeriesForRegression.length - 1].ts;
    const lastKnownDate = new Date(lastKnownTs);
    const lastKnownValue = dailySeriesForRegression[dailySeriesForRegression.length - 1].y;
    let forecastYear = lastKnownDate.getFullYear();
    let forecastMonthIndex = lastKnownDate.getMonth();

    const FORECAST_MIN = 4;
    const SMOOTH_ALPHA = 0.28;
    const MAX_STEP_PER_MONTH = 0.45;
    let previousSmoothed = Math.max(FORECAST_MIN, Math.min(12, lastKnownValue));

    const result: ChartPoint[] = [];
    while (result.length < 12) {
      forecastMonthIndex += 1;
      if (forecastMonthIndex > 11) {
        forecastMonthIndex = 0;
        forecastYear += 1;
      }

      const monthIndex = forecastMonthIndex;
      if (monthIndex === 5 || monthIndex === 6 || monthIndex === 7) {
        continue;
      }

      const forecastTs = new Date(forecastYear, forecastMonthIndex, 1).getTime();
      const forecastX = (forecastTs - firstTs) / DAY_MS;
      const predicted = intercept + slope * forecastX;

      // Dampen and cap month-to-month jump for a smoother forecast curve.
      const blended = previousSmoothed + (predicted - previousSmoothed) * SMOOTH_ALPHA;
      const delta = blended - previousSmoothed;
      const limitedDelta = Math.max(-MAX_STEP_PER_MONTH, Math.min(MAX_STEP_PER_MONTH, delta));
      const smoothed = previousSmoothed + limitedDelta;
      const bounded = Math.max(FORECAST_MIN, Math.min(12, Number(smoothed.toFixed(2))));
      const month = String(forecastMonthIndex + 1).padStart(2, "0");

      result.push({
        label: `${forecastYear}-${month}`,
        value: bounded,
      });

      previousSmoothed = bounded;
    }

    return result;
  }, [dailySeriesForRegression]);

  const chartData = useMemo<ChartPoint[]>(() => {
    if (averageByMonth) {
      return monthlyAverages.map((item) => ({ label: item.month, value: item.value }));
    }
    return dailyAverages.map((item) => ({ label: item.date, value: item.value }));
  }, [averageByMonth, dailyAverages, monthlyAverages]);

  const chartGeometry = useMemo(() => {
    const width = 900;
    const height = 280;
    const padding = 36;

    if (!chartData.length) {
      return { width, height, padding, points: [], path: "" };
    }

    const minX = 0;
    const maxX = Math.max(chartData.length - 1, 1);
    const minY = 0;
    const maxY = 12;

    const points = chartData.map((item, index) => {
      const x = padding + ((index - minX) / (maxX - minX || 1)) * (width - padding * 2);
      const y = height - padding - ((item.value - minY) / (maxY - minY || 1)) * (height - padding * 2);
      return { x, y, item };
    });

    const path = buildPath(points.map((point) => ({ x: point.x, y: point.y })));
    return { width, height, padding, points, path };
  }, [chartData]);

  const forecastGeometry = useMemo(() => {
    const width = 900;
    const height = 280;
    const padding = 36;

    if (!forecastData.length) {
      return { width, height, padding, points: [], path: "" };
    }

    const minX = 0;
    const maxX = Math.max(forecastData.length - 1, 1);
    const minY = 0;
    const maxY = 12;

    const points = forecastData.map((item, index) => {
      const x = padding + ((index - minX) / (maxX - minX || 1)) * (width - padding * 2);
      const y = height - padding - ((item.value - minY) / (maxY - minY || 1)) * (height - padding * 2);
      return { x, y, item };
    });

    const path = buildPath(points.map((point) => ({ x: point.x, y: point.y })));
    return { width, height, padding, points, path };
  }, [forecastData]);

  return (
    <>
      <div className="card p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row gap-4 sm:items-end sm:justify-between">
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

          <div className="flex items-center gap-6 text-sm">
            <label className="flex items-center gap-2 text-gray-700">
              <input
                type="checkbox"
                checked={averageByMonth}
                onChange={(e) => setAverageByMonth(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              середня за місяць
            </label>
            <div>
              <p className="text-gray-500">Кількість точок</p>
              <p className="text-lg font-bold text-gray-900">{chartData.length}</p>
            </div>
            <div>
              <p className="text-gray-500">Середній бал</p>
              <p className="text-lg font-bold text-blue-600">{averageMark ?? "—"}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-6 shadow-lg">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600 font-medium">Завантаження аналітики...</p>
          </div>
        ) : chartData.length === 0 ? (
          <div className="text-center py-20 text-gray-600">Немає достатньо даних для побудови графіка</div>
        ) : (
          <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${chartGeometry.width} ${chartGeometry.height}`} className="min-w-[900px] w-full h-[320px]">
              {[0, 3, 6, 9, 12].map((tick) => {
                const y = chartGeometry.height - chartGeometry.padding - (tick / 12) * (chartGeometry.height - chartGeometry.padding * 2);
                return (
                  <g key={tick}>
                    <line
                      x1={chartGeometry.padding}
                      y1={y}
                      x2={chartGeometry.width - chartGeometry.padding}
                      y2={y}
                      stroke="#E5E7EB"
                    />
                    <text x={10} y={y + 4} fontSize="11" fill="#6B7280">
                      {tick}
                    </text>
                  </g>
                );
              })}

              <path d={chartGeometry.path} fill="none" stroke="#2563EB" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />

              {chartGeometry.points.map((point, index) => (
                <g key={`${point.item.label}-${index}`}>
                  <circle cx={point.x} cy={point.y} r={5} fill="#2563EB" />
                  <text x={point.x} y={chartGeometry.height - 8} textAnchor="middle" fontSize="10" fill="#6B7280">
                    {averageByMonth ? point.item.label : formatDate(point.item.label)}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        )}
      </div>

      <div className="card p-6 shadow-lg">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Прогноз динаміки (лінійна регресія)</h2>
          <p className="text-gray-600 text-sm mt-1">
            Прогноз на найближчі 12 навчальних місяців від останніх наявних даних (червень-серпень пропущено)
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600 font-medium">Розрахунок прогнозу...</p>
          </div>
        ) : forecastData.length === 0 ? (
          <div className="text-center py-16 text-gray-600">Недостатньо даних для прогнозу</div>
        ) : (
          <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${forecastGeometry.width} ${forecastGeometry.height}`} className="min-w-[900px] w-full h-[320px]">
              {[0, 3, 6, 9, 12].map((tick) => {
                const y = forecastGeometry.height - forecastGeometry.padding - (tick / 12) * (forecastGeometry.height - forecastGeometry.padding * 2);
                return (
                  <g key={tick}>
                    <line
                      x1={forecastGeometry.padding}
                      y1={y}
                      x2={forecastGeometry.width - forecastGeometry.padding}
                      y2={y}
                      stroke="#E5E7EB"
                    />
                    <text x={10} y={y + 4} fontSize="11" fill="#6B7280">
                      {tick}
                    </text>
                  </g>
                );
              })}

              <path d={forecastGeometry.path} fill="none" stroke="#7C3AED" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />

              {forecastGeometry.points.map((point, index) => (
                <g key={`${point.item.label}-${index}`}>
                  <circle cx={point.x} cy={point.y} r={5} fill="#7C3AED" />
                  <text x={point.x} y={forecastGeometry.height - 8} textAnchor="middle" fontSize="10" fill="#6B7280">
                    {formatMonthLabel(point.item.label)}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        )}
      </div>
    </>
  );
}
