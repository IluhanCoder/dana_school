import { useCallback, useEffect, useState } from "react";
import confetti from "canvas-confetti";
import $api from "../api/api";
import authService from "../auth/auth-service";
import type { ApiResponse } from "../types/api.types";
import { isBirthdayToday } from "../utils/birthday";

interface CurrentUserProfile {
  id: string;
  name: string;
  role: "student" | "teacher" | "admin";
  birthdate?: string;
}

const getTodayKey = () => new Date().toISOString().slice(0, 10);

const playBirthdayConfetti = () => {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) return;

  const durationMs = 2600;
  const end = Date.now() + durationMs;

  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 70,
      origin: { x: 0 },
      colors: ["#f59e0b", "#10b981", "#0ea5e9", "#f43f5e", "#6366f1"],
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 70,
      origin: { x: 1 },
      colors: ["#f59e0b", "#10b981", "#0ea5e9", "#f43f5e", "#6366f1"],
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  };

  frame();
};

export default function BirthdayGreetingOverlay() {
  const [visible, setVisible] = useState(false);
  const [studentName, setStudentName] = useState("");

  const checkBirthdayAndShow = useCallback(async () => {
    const role = authService.getRole();
    const userId = authService.getUserId();

    if (role !== "student" || !userId) {
      setVisible(false);
      setStudentName("");
      return;
    }

    const sessionKey = `birthday-greeting:${userId}:${getTodayKey()}`;
    if (sessionStorage.getItem(sessionKey)) {
      return;
    }

    try {
      const response = await $api.get<ApiResponse<CurrentUserProfile>>(`/users/${userId}`);
      if (!response.data.success) {
        return;
      }

      const profile = response.data.data;
      if (!isBirthdayToday(profile.birthdate)) {
        return;
      }

      setStudentName(profile.name || "друже");
      setVisible(true);
      sessionStorage.setItem(sessionKey, "1");
      playBirthdayConfetti();
    } catch {
      // Silent fail: birthday greeting is non-critical UI.
    }
  }, []);

  useEffect(() => {
    void checkBirthdayAndShow();

    const handleAuthChanged = () => {
      setVisible(false);
      setStudentName("");
      void checkBirthdayAndShow();
    };

    window.addEventListener("auth:changed", handleAuthChanged);
    return () => window.removeEventListener("auth:changed", handleAuthChanged);
  }, [checkBirthdayAndShow]);

  if (!visible) return null;

  return (
    <div className="birthday-greeting-floating" role="status" aria-live="polite">
      <div className="birthday-greeting-title">З днем народження, {studentName}! 🎉</div>
      <div className="birthday-greeting-text">Бажаємо гарного дня, натхнення та високих результатів у навчанні.</div>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="birthday-greeting-close"
        aria-label="Закрити привітання"
      >
        ✕
      </button>
    </div>
  );
}
