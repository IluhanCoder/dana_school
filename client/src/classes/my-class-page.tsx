import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import $api from "../api/api";
import type { ApiResponse } from "../types/api.types";
import type { AttendanceRecord } from "../types/attendance.types";
import { ConfirmModal } from "../components/ConfirmModal";

export default function MyClassPage() {
  const { classId } = useParams<{ classId: string }>();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [addingDate, setAddingDate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");

  if (!classId) {
    return <div className="p-6 text-red-600">Invalid class ID</div>;
  }

  useEffect(() => {
    fetchAttendance();
  }, [classId]);

  useEffect(() => {
    if (!warning) return;
    const timeout = window.setTimeout(() => setWarning(""), 4000);
    return () => window.clearTimeout(timeout);
  }, [warning]);

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
        setError(response.data.error || "Failed to fetch attendance");
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to fetch attendance");
    } finally {
      setLoading(false);
    }
  };

  const handleAddDate = async () => {
    if (!newDate) {
      setError("Please select a date");
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
        setAttendance([response.data.data, ...attendance]);
        setNewDate("");
      } else {
        setError(response.data.error || "Failed to add attendance date");
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to add attendance date");
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
      setError("Failed to update attendance");
    }
  };

  const handleDeleteRecord = async () => {
    if (!confirmDelete) return;

    try {
      await $api.delete(`/attendance/${classId}/${confirmDelete}`);
      setAttendance(attendance.filter((r) => r.id !== confirmDelete));
      setConfirmDelete(null);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to delete record");
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
      { id: string; name: string; email: string; isArchived?: boolean }
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
          <div className="flex gap-4">
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={addingDate}
            />
            <button
              onClick={handleAddDate}
              disabled={addingDate}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {addingDate ? "Додавання..." : "Додати"}
            </button>
          </div>
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-6 py-3 text-left font-medium text-gray-900 sticky left-0 bg-gray-50 min-w-[260px] w-[260px] z-20 border-r border-gray-200">
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
                    students.map((student, idx) => (
                      <tr
                        key={student.id}
                        className={`border-b border-gray-200 ${
                          idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                        }`}
                      >
                        <td className={`px-6 py-3 sticky left-0 min-w-[260px] w-[260px] z-10 border-r border-gray-200 ${
                          idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                        }`}>
                          <div className="font-medium text-gray-900">
                            {student.name}
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
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
    </div>
  );
}
