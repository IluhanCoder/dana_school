import { useState } from "react";
import { Upload, X, Eye } from "lucide-react";
import * as XLSX from "xlsx";
import $api from "../api/api";
import type { ApiResponse } from "../types/api.types";

interface ImportResult {
  message: string;
  created: number;
  skipped: number;
  errors: string[];
}

interface StudentImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: ImportResult) => void;
}

interface StudentPreview {
  name: string;
  accountNumber: string;
  parentContact: string;
}

export default function StudentImportModal({ isOpen, onClose, onSuccess }: StudentImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [grade, setGrade] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [preview, setPreview] = useState<StudentPreview[] | null>(null);

  const resetForm = () => {
    setFile(null);
    setGrade("");
    setError("");
    setResult(null);
    setPreview(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!["application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"].includes(selectedFile.type)) {
        setError("Будь ласка, виберіть Excel файл (.xls або .xlsx)");
        setPreview(null);
        return;
      }
      setFile(selectedFile);
      setError("");
      
      // Parse preview
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = event.target?.result;
          const workbook = XLSX.read(data, { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "", raw: false });
          
          // Extract first 5 rows for preview
          const previewData: StudentPreview[] = rows.slice(0, 5).map((row: Record<string, any>) => {
            // Try to find columns by matching keywords
            const keys = Object.keys(row);
            const nameKey = keys.find(k => k.toLowerCase().includes("піб")) || keys[0];
            const numberKey = keys.find(k => k.toLowerCase().includes("номер") && !k.toLowerCase().includes("телефон")) || keys[1];
            const parentKey = keys.find(k => k.toLowerCase().includes("батьк")) || keys[2];
            
            return {
              name: (row[nameKey] || "").toString().trim(),
              accountNumber: (row[numberKey] || "").toString().trim(),
              parentContact: (row[parentKey] || "").toString().trim(),
            };
          });
          
          setPreview(previewData);
        } catch (err) {
          setError("Помилка при читанні файлу");
          setPreview(null);
        }
      };
      reader.readAsArrayBuffer(selectedFile);
    }
  };

  const handleImport = async () => {
    if (!file) {
      setError("Виберіть файл для імпорту");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const formData = new FormData();
      formData.append("file", file);

      let url = "/users/import/excel";
      if (grade) {
        url += `?grade=${grade}`;
      }

      const response = await $api.post<ApiResponse<ImportResult>>(url, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (!response.data.success) {
        setError(response.data.error || "Помилка імпорту");
        return;
      }

      setResult(response.data.data);
      onSuccess?.(response.data.data);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || "Помилка під час імпорту");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-900">Імпортувати учнів</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 max-h-[calc(90vh-150px)]">
          {!result ? (
            <>
              {/* File Upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Excel файл</label>
                <div className="relative">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                    disabled={loading}
                  />
                  <label
                    htmlFor="file-upload"
                    className="flex items-center justify-center w-full px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 transition-colors cursor-pointer group"
                  >
                    <div className="text-center">
                      <Upload className="w-8 h-8 text-gray-400 group-hover:text-blue-500 mx-auto mb-2 transition-colors" />
                      <p className="text-sm font-medium text-gray-700">
                        {file ? "✓ " + file.name : "Натисніть для вибору файлу"}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">.xlsx або .xls</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Preview Section */}
              {preview && preview.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="w-4 h-4 text-blue-600" />
                    <p className="text-xs font-semibold text-blue-900">Превʼю учнів ({preview.length} перших)</p>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {preview.map((student, idx) => (
                      <div key={idx} className="bg-white rounded p-2 text-xs border border-blue-100">
                        <p className="font-medium text-gray-900 truncate">{student.name || "—"}</p>
                        <p className="text-gray-600 text-xs">№ {student.accountNumber || "—"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Grade Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Клас (необов'язково)</label>
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  disabled={loading}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 font-medium"
                >
                  <option value="">— Не обирати клас —</option>
                  {Array.from({ length: 9 }, (_, i) => i).map((g) => (
                    <option key={g} value={g}>
                      {g} клас
                    </option>
                  ))}
                </select>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-50 border-l-4 border-red-500 text-red-800 text-sm px-4 py-3 rounded flex items-start gap-3">
                  <span className="text-red-500 text-lg">⚠</span>
                  <p>{error}</p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg border border-gray-200 text-gray-900 hover:bg-gray-50 transition-colors"
                >
                  Скасувати
                </button>
                <button
                  onClick={handleImport}
                  disabled={!file || loading}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Імпортування..." : "Імпортувати"}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Results */}
              <div className="space-y-4">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-3">
                    <span className="text-green-600 text-xl">✓</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-900">{result.message}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 rounded-lg p-4 text-center border border-green-200">
                    <p className="text-2xl font-bold text-green-600">{result.created}</p>
                    <p className="text-xs text-green-700 font-medium mt-1">Створено</p>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-4 text-center border border-yellow-200">
                    <p className="text-2xl font-bold text-yellow-600">{result.skipped}</p>
                    <p className="text-xs text-yellow-700 font-medium mt-1">Пропущено</p>
                  </div>
                </div>

                {result.errors.length > 0 && (
                  <div className="max-h-48 overflow-y-auto bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-xs font-semibold text-gray-900 mb-2">Помилки та попередження:</p>
                    <ul className="space-y-1">
                      {result.errors.map((error, idx) => (
                        <li key={idx} className="text-xs text-gray-700 flex gap-2">
                          <span className="text-gray-400 flex-shrink-0">•</span>
                          <span>{error}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setResult(null)}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg border-2 border-blue-600 text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  Імпортувати ще
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Закрити
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
