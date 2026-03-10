import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import $api from "../api/api";
import type { ApiResponse } from "../types/api.types";
import type { AttendanceRecord } from "../types/attendance.types";
import { ConfirmModal } from "../components/ConfirmModal";
import { LocalizedDatePicker } from "../components/LocalizedDatePicker";
import { isBirthdayToday } from "../utils/birthday";

export default function MyClassPage() {
  const { classId } = useParams<{ classId: string }>();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [addingDate, setAddingDate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [mobileRecordIndex, setMobileRecordIndex] = useState(0);
  const [mobileDateToast, setMobileDateToast] = useState("");

  if (!classId) {
    return <div className="p-6 text-red-600">Невалідний ID класу</div>;
  }

  useEffect(() => {
    fetchAttendance();
  }, [classId]);

  useEffect(() => {
    if (!warning) return;
    const timeout = window.setTimeout(() => setWarning(""), 4000);
    return () => window.clearTimeout(timeout);
  }, [warning]);

  useEffect(() => {
    if (!mobileDateToast) return;
    const timeout = window.setTimeout(() => setMobileDateToast(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [mobileDateToast]);

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await $api.get<ApiResponse<AttendanceRecord[]>>(
        `/attendance/${classId}`
      );
      if (response.data.success) {
        setAttendance(response.data.data || []);
      } else {
        setError(response.data.error || "Не вдалося отримати відвідування");
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Не вдалося отримати відвідування");
    } finally {
      setLoading(false);
    }
  };

  const handleAddDate = async () => {
    if (!newDate) {
      setError("Будь ласка, оберіть дату");
      return;
    }

    try {
      setAddingDate(true);
      setError("");
      const response = await $api.post<ApiResponse<AttendanceRecord>>(
        `/attendance/${classId}`,
        { date: newDate }
      );
      if (response.data.success) {
        const createdRecord = (response.data as any).data as AttendanceRecord;
        const nextAttendance = [createdRecord, ...attendance];
        setAttendance(nextAttendance);
        const nextSorted = [...nextAttendance].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        const createdIndex = nextSorted.findIndex((record) => record.id === createdRecord.id);
        if (createdIndex >= 0) {
          setMobileRecordIndex(createdIndex);
        }
        setNewDate("");
      } else {
        setError(response.data.error || "Не вдалося додати дату відвідування");
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Не вдалося додати дату відвідування");
    } finally {
      setAddingDate(false);
    }
  };

  const handleTogglePresent = async (
    recordId: string,
    studentId: string,
    currentStatus: boolean
  ) => {
    try {
      const response = await $api.patch<ApiResponse<AttendanceRecord>>(
        `/attendance/${classId}/${recordId}/${studentId}`,
        { present: !currentStatus }
      );
      if ((response.data as any).success) {
        const updatedRecord = (response.data as any).data as AttendanceRecord;
        setWarning(updatedRecord?.warning || "");
        setAttendance(
          attendance.map((r) => (r.id === recordId ? updatedRecord : r))
        );
      }
    } catch (err) {
      setError("Не вдалося оновити відвідування");
    }
  };

  const handleDeleteRecord = async () => {
    if (!confirmDelete) return;

    try {
      await $api.delete(`/attendance/${classId}/${confirmDelete}`);
      setAttendance(attendance.filter((r) => r.id !== confirmDelete));
      setConfirmDelete(null);
    } catch (err: any) {
      setError(err.response?.data?.error || "Не вдалося видалити запис");
      setConfirmDelete(null);
    }
  };

  const formatDate = (date: string | Date) => {
    return new Intl.DateTimeFormat("uk-UA", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(date));
  };

  const sortedRecords = useMemo(() => {
    return [...attendance].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [attendance]);

  const students = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; email: string; birthdate?: string; isArchived?: boolean }
    >();

    sortedRecords.forEach((record) => {
      record.entries.forEach((entry) => {
        if (!map.has(entry.student.id)) {
          map.set(entry.student.id, entry.student);
        }
      });
    });

    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "uk-UA")
    );
  }, [sortedRecords]);

  const presenceMap = useMemo(() => {
    const map = new Map<string, boolean>();

    sortedRecords.forEach((record) => {
      record.entries.forEach((entry) => {
        map.set(`${record.id}:${entry.student.id}`, entry.present);
      });
    });

    return map;
  }, [sortedRecords]);

  const selectedMobileRecordIndex = Math.min(
    Math.max(mobileRecordIndex, 0),
    Math.max(sortedRecords.length - 1, 0)
  );
  const selectedMobileRecord = sortedRecords[selectedMobileRecordIndex];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Облік відвідування</h1>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Add New Date Section */}
        <div className="mb-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Додати нову дату</h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="w-full sm:w-auto">
              <LocalizedDatePicker
                value={newDate}
                onChange={setNewDate}
                className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={addingDate}
              />
            </div>
            <button
              onClick={handleAddDate}
              disabled={addingDate}
              className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {addingDate ? "Додавання..." : "Додати"}
            </button>
          </div>
          {newDate && (
            <p className="mt-2 text-sm text-gray-600">
              Обрана дата: {formatDate(newDate)}
            </p>
          )}
        </div>

        {/* Attendance Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-gray-600">Завантаження...</p>
            </div>
          ) : sortedRecords.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">Немає записів про облік відвідування</p>
            </div>
          ) : (
            <>
              <div className="md:hidden px-4 py-4 border-b border-gray-200 bg-white space-y-4">
                {selectedMobileRecord && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Дата</label>
                      <LocalizedDatePicker
                        value={new Date(selectedMobileRecord.date).toISOString().slice(0, 10)}
                        min={sortedRecords[0] ? new Date(sortedRecords[0].date).toISOString().slice(0, 10) : undefined}
                        max={sortedRecords[sortedRecords.length - 1] ? new Date(sortedRecords[sortedRecords.length - 1].date).toISOString().slice(0, 10) : undefined}
                        onChange={(picked) => {
                          if (!picked) return;
                          const nextIndex = sortedRecords.findIndex(
                            (record) => new Date(record.date).toISOString().slice(0, 10) === picked
                          );
                          if (nextIndex >= 0) {
                            setMobileRecordIndex(nextIndex);
                          } else {
                            setMobileDateToast("На вибрану дату немає запису відвідування");
                          }
                        }}
                        className="input-field w-full"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setMobileRecordIndex((prev) => Math.max(0, prev - 1))}
                        disabled={selectedMobileRecordIndex <= 0}
                        className="h-10 w-10 rounded-lg border border-gray-300 text-gray-700 disabled:opacity-40"
                        aria-label="Попередня дата"
                      >
                        ←
                      </button>
                      <div className="flex-1">
                        <select
                          value={selectedMobileRecord.id}
                          onChange={(e) => {
                            const nextIndex = sortedRecords.findIndex((record) => record.id === e.target.value);
                            setMobileRecordIndex(nextIndex >= 0 ? nextIndex : 0);
                          }}
                          className="input-field w-full"
                        >
                          {sortedRecords.map((record, index) => (
                            <option key={record.id} value={record.id}>
                              {index + 1}. {formatDate(record.date)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMobileRecordIndex((prev) => Math.min(sortedRecords.length - 1, prev + 1))}
                        disabled={selectedMobileRecordIndex >= sortedRecords.length - 1}
                        className="h-10 w-10 rounded-lg border border-gray-300 text-gray-700 disabled:opacity-40"
                        aria-label="Наступна дата"
                      >
                        →
                      </button>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900">{formatDate(selectedMobileRecord.date)}</p>
                      <button
                        onClick={() => setConfirmDelete(selectedMobileRecord.id)}
                        className="px-3 py-1.5 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg"
                      >
                        Видалити
                      </button>
                    </div>

                    <div className="space-y-2">
                      {students.length === 0 ? (
                        <div className="px-3 py-6 text-center text-gray-500 text-sm">Немає учнів</div>
                      ) : (
                        students.map((student) => {
                          const key = `${selectedMobileRecord.id}:${student.id}`;
                          const present = presenceMap.get(key);
                          const hasEntry = typeof present === "boolean";

                          return (
                            <div key={student.id} className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 ${isBirthdayToday(student.birthdate) ? "border-amber-300 bg-amber-50" : "border-gray-200 bg-white"}`}>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {student.name}
                                  {isBirthdayToday(student.birthdate) && <span className="ml-2 text-amber-700">🎉</span>}
                                  {student.isArchived && <span className="ml-2 text-xs text-gray-500">(Архів)</span>}
                                </p>
                                <p className="text-xs text-gray-500 truncate">{student.email}</p>
                              </div>
                              {hasEntry ? (
                                <button
                                  onClick={() => handleTogglePresent(selectedMobileRecord.id, student.id, !!present)}
                                  className={`px-3 py-1.5 rounded font-semibold text-white text-sm transition-colors ${
                                    present ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                                  }`}
                                >
                                  {present ? "✓" : "✗"}
                                </button>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="overflow-x-auto hidden md:block">
              <div className="px-4 pt-3 text-xs text-gray-500 md:hidden">Проведіть вліво/вправо, щоб переглянути всі дати.</div>
              <table className="min-w-[720px] w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 md:px-6 text-left font-medium text-gray-900 md:sticky md:left-0 bg-gray-50 min-w-[220px] md:min-w-[260px] w-[220px] md:w-[260px] z-20 border-r border-gray-200">
                      Учень
                    </th>
                    {sortedRecords.map((record) => (
                      <th
                        key={record.id}
                        className="px-4 py-3 text-center font-medium text-gray-900 min-w-[140px]"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <span>{formatDate(record.date)}</span>
                          <button
                            onClick={() => setConfirmDelete(record.id)}
                            className="w-6 h-6 inline-flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                            title="Видалити дату"
                          >
                            ×
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.length === 0 ? (
                    <tr>
                      <td
                        colSpan={sortedRecords.length + 1}
                        className="px-6 py-6 text-center text-gray-500"
                      >
                        Немає учнів
                      </td>
                    </tr>
                  ) : (
                    students.map((student, idx) => {
                      const hasBirthdayToday = isBirthdayToday(student.birthdate);
                      return (
                      <tr
                        key={student.id}
                        className={`border-b border-gray-200 ${
                          hasBirthdayToday ? "bg-amber-50" : idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                        }`}
                      >
                        <td className={`px-4 py-3 md:px-6 md:sticky md:left-0 min-w-[220px] md:min-w-[260px] w-[220px] md:w-[260px] z-10 border-r border-gray-200 ${
                          hasBirthdayToday ? "bg-amber-50" : idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                        }`}>
                          <div className="font-medium text-gray-900">
                            {student.name}
                            {hasBirthdayToday && <span className="ml-2 text-amber-700">🎉</span>}
                            {student.isArchived && (
                              <span className="ml-2 text-xs text-gray-500">(Архів)</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">{student.email}</div>
                        </td>
                        {sortedRecords.map((record) => {
                          const key = `${record.id}:${student.id}`;
                          const present = presenceMap.get(key);
                          const hasEntry = typeof present === "boolean";

                          return (
                            <td key={record.id} className="px-4 py-3 text-center">
                              {hasEntry ? (
                                <button
                                  onClick={() =>
                                    handleTogglePresent(record.id, student.id, !!present)
                                  }
                                  className={`px-3 py-1 rounded font-medium text-white transition-colors ${
                                    present
                                      ? "bg-green-600 hover:bg-green-700"
                                      : "bg-red-600 hover:bg-red-700"
                                  }`}
                                >
                                  {present ? "✓" : "✗"}
                                </button>
                              ) : (
                                <span className="text-gray-400">—</span>
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
            </>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!confirmDelete}
        title="Видалити запис про облік?"
        message="Ви впевнені, що хочете видалити цей запис про облік відвідування? Це не можна скасувати."
        confirmText="Видалити"
        cancelText="Скасувати"
        onConfirm={handleDeleteRecord}
        onCancel={() => setConfirmDelete(null)}
        isDangerous={true}
      />

      {warning && (
        <div className="fixed top-4 right-4 z-50 max-w-md w-[calc(100%-2rem)] sm:w-auto">
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg shadow-lg px-4 py-3 flex items-start gap-3">
            <span className="text-yellow-600 text-lg leading-none">⚠</span>
            <p className="text-sm leading-5">{warning}</p>
            <button
              type="button"
              onClick={() => setWarning("")}
              className="ml-1 text-yellow-700 hover:text-yellow-900"
              aria-label="Закрити попередження"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {mobileDateToast && (
        <div className="fixed top-4 right-4 z-50 max-w-md w-[calc(100%-2rem)] sm:w-auto">
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg shadow-lg px-4 py-3 flex items-start gap-3">
            <span className="text-amber-600 text-lg leading-none">⚠</span>
            <p className="text-sm leading-5">{mobileDateToast}</p>
            <button
              type="button"
              onClick={() => setMobileDateToast("")}
              className="ml-1 text-amber-700 hover:text-amber-900"
              aria-label="Закрити повідомлення"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
