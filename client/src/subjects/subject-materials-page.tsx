import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import $api from "../api/api";
import type { ApiResponse } from "../types/api.types";
import type { SubjectDetail, SubjectMaterial } from "../types/subject.types";
import authService from "../auth/auth-service";

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export default function SubjectMaterialsPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [subjectName, setSubjectName] = useState("");
  const [materials, setMaterials] = useState<SubjectMaterial[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingMaterialId, setDeletingMaterialId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const role = authService.getRole();
  const isAdmin = authService.isAdmin();
  const canManageMaterials = role === "admin" || role === "teacher";

  useEffect(() => {
    if (!id) return;
    fetchPageData(id);
  }, [id]);

  const fetchPageData = async (subjectId: string) => {
    try {
      setLoading(true);
      setError("");

      const [subjectResponse, materialsResponse] = await Promise.all([
        $api.get<ApiResponse<SubjectDetail>>(`/subjects/${subjectId}`),
        $api.get<ApiResponse<SubjectMaterial[]>>(`/subjects/${subjectId}/materials`),
      ]);

      if (!subjectResponse.data.success) {
        setError(subjectResponse.data.error || "Не вдалося завантажити предмет");
        return;
      }

      if (!materialsResponse.data.success) {
        setError(materialsResponse.data.error || "Не вдалося завантажити матеріали");
        return;
      }

      setSubjectName(subjectResponse.data.data.subject.name);
      setMaterials(materialsResponse.data.data || []);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || "Не вдалося завантажити матеріали");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    if (!selectedFile) {
      setError("Оберіть PDF файл");
      return;
    }

    if (selectedFile.type !== "application/pdf") {
      setError("Дозволено лише PDF файли");
      return;
    }

    try {
      setUploading(true);
      setError("");

      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await $api.post<ApiResponse<SubjectMaterial>>(
        `/subjects/${id}/materials`,
        formData
      );
      const resp = response.data;

      if (!resp.success) {
        setError(resp.error || "Не вдалося завантажити файл");
        return;
      }

      setMaterials((prev) => [resp.data, ...prev]);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || "Не вдалося завантажити файл");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteMaterial = async (material: SubjectMaterial) => {
    if (!id) return;

    const confirmed = window.confirm(`Видалити PDF \"${material.title}\"?`);
    if (!confirmed) return;

    try {
      setDeletingMaterialId(material.id);
      setError("");

      const response = await $api.delete<ApiResponse<{ id: string }>>(
        `/subjects/${id}/materials/${encodeURIComponent(material.id)}`
      );

      if (!response.data.success) {
        setError(response.data.error || "Не вдалося видалити матеріал");
        return;
      }

      setMaterials((prev) => prev.filter((item) => item.id !== material.id));
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || "Не вдалося видалити матеріал");
    } finally {
      setDeletingMaterialId(null);
    }
  };

  if (!id) {
    return <div className="p-6 text-red-600">Невалідний ID предмета</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-12 space-y-8">
        <button
          onClick={() => navigate(`/subjects/${id}`)}
          className="inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
        >
          ← Назад до предмету
        </button>

        <div>
          <h1 className="text-3xl font-bold text-gray-900">Матеріали предмету</h1>
          <p className="text-gray-600 mt-2">
            {subjectName ? `Предмет: ${subjectName}` : "Завантаження..."}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-800 text-sm px-5 py-4 rounded flex items-start gap-3">
            <span className="text-red-500 text-xl">⚠</span>
            <p>{error}</p>
          </div>
        )}

        {canManageMaterials && (
          <div className="card p-6 shadow-lg">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Завантажити PDF {isAdmin ? "(адміністратор)" : "(викладач)"}
            </h2>
            <form className="space-y-4" onSubmit={handleUpload}>
              <input
                ref={fileInputRef}
                id="subject-material-file"
                type="file"
                accept="application/pdf"
                onChange={(e) => {
                  setSelectedFile(e.target.files?.[0] || null);
                  setError("");
                }}
                className="hidden"
              />
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-secondary"
                >
                  Обрати PDF
                </button>
                <span className="text-sm text-gray-600">
                  {selectedFile ? selectedFile.name : "Файл не вибрано"}
                </span>
              </div>
              <button
                type="submit"
                disabled={uploading || !selectedFile}
                className="btn-primary"
              >
                {uploading ? "Завантаження..." : "Завантажити PDF"}
              </button>
            </form>
          </div>
        )}

        <div className="card p-6 shadow-lg">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Завантажені матеріали</h2>

          {loading ? (
            <p className="text-gray-600">Завантаження...</p>
          ) : materials.length === 0 ? (
            <p className="text-gray-600">Поки що немає завантажених PDF матеріалів</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-left font-medium text-gray-900">Файл</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-900">Розмір</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-900">Завантажив</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-900">Дата</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-900">Дія</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((material) => (
                    <tr key={material.id} className="border-b border-gray-100">
                      <td className="px-4 py-3 text-gray-900">{material.title}</td>
                      <td className="px-4 py-3 text-gray-600">{formatSize(material.size)}</td>
                      <td className="px-4 py-3 text-gray-600">{material.uploadedBy.name}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {new Date(material.uploadedAt).toLocaleString("uk-UA")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-4">
                          <a
                            href={material.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Відкрити PDF
                          </a>
                          {canManageMaterials && (
                            <button
                              onClick={() => handleDeleteMaterial(material)}
                              disabled={deletingMaterialId === material.id}
                              className="text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                            >
                              {deletingMaterialId === material.id ? "Видалення..." : "Видалити"}
                            </button>
                          )}
                        </div>
                      </td>
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
