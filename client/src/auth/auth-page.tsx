import { useState } from "react";
import { useNavigate } from "react-router-dom";
import authService from "./auth-service";

type AuthMode = "login" | "register";

export default function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [registerData, setRegisterData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLoginData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRegisterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setRegisterData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if (!loginData.email || !loginData.password) {
        setError("Заповніть усі поля");
        setLoading(false);
        return;
      }

      const isAdminKeyword = loginData.email === "admin";
      const looksLikeEmail = loginData.email.includes("@");
      if (!isAdminKeyword && !looksLikeEmail) {
        setError("Email повинен містити '@' або використовуйте 'admin'");
        setLoading(false);
        return;
      }

      await authService.login(loginData.email, loginData.password);
      setSuccess("Вхід успішний!");
      setTimeout(() => {
        const role = authService.getRole();
        if (role === "admin") {
          navigate("/dashboard");
          return;
        }
        navigate("/subjects");
      }, 800);
    } catch (err: any) {
      setError(err.message || "Помилка входу");
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if (!registerData.name || !registerData.email || !registerData.password || !registerData.confirmPassword) {
        setError("Заповніть усі поля");
        setLoading(false);
        return;
      }

      if (registerData.password !== registerData.confirmPassword) {
        setError("Паролі не збігаються");
        setLoading(false);
        return;
      }

      if (registerData.password.length < 6) {
        setError("Пароль повинен містити мінімум 6 символів");
        setLoading(false);
        return;
      }

      await authService.register(registerData.name, registerData.email, registerData.password);
      setSuccess("Аккаунт створено!");
      setTimeout(() => navigate("/"), 800);
    } catch (err: any) {
      setError(err.message || "Помилка реєстрації");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold text-gray-900 mb-3">Dana School</h1>
          <p className="text-gray-600">Система управління навчанням</p>
        </div>

        {/* Auth Card */}
        <div className="card shadow-2xl">
          {/* Tab Navigation */}
          <div className="flex border-b border-gray-200 bg-gray-50">
            <button
              onClick={() => {
                setMode("login");
                setError("");
                setSuccess("");
              }}
              className={`flex-1 py-4 text-sm font-semibold transition-all ${
                mode === "login"
                  ? "text-blue-600 border-b-2 border-blue-600 bg-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Вхід
            </button>
            <button
              onClick={() => {
                setMode("register");
                setError("");
                setSuccess("");
              }}
              className={`flex-1 py-4 text-sm font-semibold transition-all ${
                mode === "register"
                  ? "text-blue-600 border-b-2 border-blue-600 bg-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Реєстрація
            </button>
          </div>

          {/* Form Content */}
          <div className="p-10">
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 text-red-800 text-sm px-4 py-3 rounded mb-6 flex items-start gap-3">
                <span className="text-red-500 text-xl">⚠</span>
                <p>{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-green-50 border-l-4 border-green-500 text-green-800 text-sm px-4 py-3 rounded mb-6 flex items-start gap-3">
                <span className="text-green-500 text-xl">✓</span>
                <p>{success}</p>
              </div>
            )}

            {mode === "login" && (
              <form onSubmit={handleLoginSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">Email</label>
                  <input
                    type="text"
                    name="email"
                    value={loginData.email}
                    onChange={handleLoginChange}
                    placeholder="your@email.com"
                    className="input-field"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">Пароль</label>
                  <input
                    type="password"
                    name="password"
                    value={loginData.password}
                    onChange={handleLoginChange}
                    placeholder="••••••••"
                    className="input-field"
                    disabled={loading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full py-3 mt-8 shadow-lg hover:shadow-xl transition-shadow"
                >
                  {loading ? "Завантаження..." : "Увійти"}
                </button>
              </form>
            )}

            {mode === "register" && (
              <form onSubmit={handleRegisterSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">Ім'я</label>
                  <input
                    type="text"
                    name="name"
                    value={registerData.name}
                    onChange={handleRegisterChange}
                    placeholder="John Doe"
                    className="input-field"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={registerData.email}
                    onChange={handleRegisterChange}
                    placeholder="your@email.com"
                    className="input-field"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">Пароль</label>
                  <input
                    type="password"
                    name="password"
                    value={registerData.password}
                    onChange={handleRegisterChange}
                    placeholder="••••••••"
                    className="input-field"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">Підтвердьте пароль</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={registerData.confirmPassword}
                    onChange={handleRegisterChange}
                    placeholder="••••••••"
                    className="input-field"
                    disabled={loading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full py-3 mt-8 shadow-lg hover:shadow-xl transition-shadow"
                >
                  {loading ? "Завантаження..." : "Зареєструватися"}
                </button>
              </form>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-10 py-6 border-t border-gray-200 text-center rounded-b-lg">
            <p className="text-gray-700 text-sm">
              {mode === "login" ? "Немає аккаунту? " : "Вже маєте аккаунт? "}
              <button
                onClick={() => {
                  setMode(mode === "login" ? "register" : "login");
                  setError("");
                  setSuccess("");
                }}
                className="text-blue-600 font-semibold hover:text-blue-700 transition-colors"
              >
                {mode === "login" ? "Зареєструватися" : "Увійти"}
              </button>
            </p>
          </div>
        </div>

        {/* Test credentials */}
        <div className="mt-8 p-4 bg-white rounded-lg shadow-md border border-blue-200">
          <p className="text-xs text-gray-600 font-medium mb-2">💡 Тестові облікові дані:</p>
          <div className="space-y-1">
            <p className="text-xs text-gray-700">Email: <span className="font-mono font-bold text-blue-600">admin@test.com</span></p>
            <p className="text-xs text-gray-700">Пароль: <span className="font-mono font-bold text-blue-600">password</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}