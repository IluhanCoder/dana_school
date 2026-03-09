import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5001/api";

const $api = axios.create({
  withCredentials: true,
  baseURL: API_URL,
});

$api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if(token) 
      config.headers = {
        authorization: `Bearer ${token}`,
      } as any;
    return config;
  }
)

// Auto-refresh access token on 401 and retry original request
$api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest: any = error?.config;

    // If refresh itself failed or request is unauthenticated login/register, do not loop
    const isRefreshCall = originalRequest?.url?.includes("/auth/refresh");
    const isAuthRoute = originalRequest?.url?.includes("/auth/login") || originalRequest?.url?.includes("/auth/register");

    if (error?.response?.status === 401 && !originalRequest?._retry && !isRefreshCall && !isAuthRoute) {
      originalRequest._retry = true;
      try {
        const res = await $api.post("/auth/refresh");
        const { accessToken } = res.data.data;
        localStorage.setItem("token", accessToken);

        originalRequest.headers = {
          ...(originalRequest.headers || {}),
          authorization: `Bearer ${accessToken}`,
        };

        return $api(originalRequest);
      } catch (refreshError) {
        dropHeader();
        localStorage.removeItem("token");
        window.location.href = "/auth";
        return Promise.reject(refreshError);
      }
    }

    // If refresh call failed, clear token and redirect once
    if (isRefreshCall && error?.response?.status === 401) {
      dropHeader();
      localStorage.removeItem("token");
      window.location.href = "/auth";
    }

    return Promise.reject(error);
  }
);

export function setHeader(token: string) {
  $api.defaults.headers.common['authorization'] = `Bearer ${token}`;
}

export function dropHeader() {
  delete $api.defaults.headers.common['authorization'];
}

export default $api;