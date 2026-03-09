import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import authService from "../auth/auth-service";
import $api from "../api/api";
import type { ApiResponse } from "../types/api.types";

interface ClassInfo {
  id: string;
  grade: number;
}

export default function Header() {
  const [isAuthenticated, setIsAuthenticated] = useState(authService.isAuthenticated());
  const [isAdmin, setIsAdmin] = useState(authService.isAdmin());
  const [isTeacher, setIsTeacher] = useState(authService.getRole() === "teacher");
  const [isStudent, setIsStudent] = useState(authService.getRole() === "student");
  const [myClass, setMyClass] = useState<ClassInfo | null>(null);

  useEffect(() => {
    const syncAuth = () => {
      setIsAuthenticated(authService.isAuthenticated());
      setIsAdmin(authService.isAdmin());
      setIsTeacher(authService.getRole() === "teacher");
      setIsStudent(authService.getRole() === "student");
    };

    syncAuth();
    window.addEventListener("auth:changed", syncAuth);
    window.addEventListener("storage", syncAuth);

    return () => {
      window.removeEventListener("auth:changed", syncAuth);
      window.removeEventListener("storage", syncAuth);
    };
  }, []);

  useEffect(() => {
    if (isTeacher && isAuthenticated) {
      fetchMyClass();
    }
  }, [isTeacher, isAuthenticated]);

  const fetchMyClass = async () => {
    try {
      const response = await $api.get<ApiResponse<ClassInfo>>("/users/my-class");
      if (response.data.success && response.data.data) {
        setMyClass(response.data.data);
      }
    } catch (err: any) {
      // Вчитель не є класним керівником
    }
  };

  const handleLogout = () => {
    authService.logout().then(() => {
      window.location.href = "/auth";
    });
  };

  return (
    <header className="border-b border-gray-200 bg-white shadow-sm">
      <nav className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        <Link to="/" className="group">
          <span className="text-2xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">Dana School</span>
        </Link>

        <div className="flex gap-8 items-center">
          {isAuthenticated ? (
            <>
              {isAdmin && (
                <Link
                  to="/dashboard"
                  className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors relative group"
                >
                  Dashboard
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-600 group-hover:w-full transition-all duration-300"></span>
                </Link>
              )}
              <Link
                to="/subjects"
                className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors relative group"
              >
                Предмети
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-600 group-hover:w-full transition-all duration-300"></span>
              </Link>
              {!isAdmin && (
                <Link
                  to="/account"
                  className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors relative group"
                >
                  Обліковий запис
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-600 group-hover:w-full transition-all duration-300"></span>
                </Link>
              )}
              {isStudent && (
                <Link
                  to="/analytics"
                  className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors relative group"
                >
                  Аналітика
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-600 group-hover:w-full transition-all duration-300"></span>
                </Link>
              )}
              {isStudent && (
                <Link
                  to="/generation"
                  className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors relative group"
                >
                  Генерація
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-600 group-hover:w-full transition-all duration-300"></span>
                </Link>
              )}
              {(isTeacher || isAdmin) && (
                <Link
                  to="/performance-monitoring"
                  className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors relative group"
                >
                  Моніторинг
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-600 group-hover:w-full transition-all duration-300"></span>
                </Link>
              )}
              {myClass && (
                <Link
                  to={`/my-class/${myClass.id}`}
                  className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors relative group"
                >
                  Мій клас ({myClass.grade})
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-600 group-hover:w-full transition-all duration-300"></span>
                </Link>
              )}
              {isAdmin && (
                <Link
                  to="/classes"
                  className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors relative group"
                >
                  Класи
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-600 group-hover:w-full transition-all duration-300"></span>
                </Link>
              )}
              {isAdmin && (
                <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 border border-blue-300">
                  Admin
                </span>
              )}
              <button
                onClick={handleLogout}
                className="text-sm font-medium text-gray-700 hover:text-red-600 transition-colors px-4 py-2 rounded-lg hover:bg-red-50"
              >
                Вихід
              </button>
            </>
          ) : (
            <Link
              to="/auth"
              className="px-5 py-2.5 text-sm font-semibold bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:shadow-lg hover:shadow-blue-500/30 transition-all hover:-translate-y-0.5"
            >
              Вхід
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
