/// <reference types="vitest" />
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

// Mock bcrypt first
vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn().mockResolvedValue(true),
    hash: vi.fn().mockResolvedValue("$2a$10$hashed_password"),
  },
}));

// Mocks
const userServiceMock = {
  getUserByEmail: vi.fn(),
  createUserWithHash: vi.fn(),
};

const userModelMock = {
  findOne: vi.fn(),
};

const registrationRequestModelMock = {
  findOne: vi.fn(),
  find: vi.fn(),
  create: vi.fn(),
  findById: vi.fn(),
  findByIdAndDelete: vi.fn(),
};

vi.mock("../user/user-service", () => ({ default: userServiceMock }));
vi.mock("../user/user-model", () => ({ default: userModelMock }));
vi.mock("../auth/registration-request-model", () => ({ default: registrationRequestModelMock }));

let authService: any;

describe("AuthService JWT", () => {
  const TEST_JWT_SECRET = "test_secret";
  const TEST_JWT_REFRESH_SECRET = "test_refresh_secret";

  beforeAll(() => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    process.env.JWT_REFRESH_SECRET = TEST_JWT_REFRESH_SECRET;
    return import("../auth/auth-service").then(mod => {
      authService = mod.default;
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("verifyToken returns decoded payload for valid token", () => {
    const payload = { id: "user123", email: "user@example.com" };
    const token = jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: "15m" });

    const decoded = authService.verifyToken(token);
    expect(decoded.id).toBe(payload.id);
    expect(decoded.email).toBe(payload.email);
  });

  it("verifyToken throws for invalid token", () => {
    expect(() => authService.verifyToken("invalid.token.value")).toThrow();
  });

  it("refreshAccessToken issues a new valid access token from refresh token", async () => {
    const payload = { id: "user123", email: "user@example.com" };
    const refreshToken = jwt.sign(payload, TEST_JWT_REFRESH_SECRET, { expiresIn: "7d" });

    const { accessToken } = await authService.refreshAccessToken(refreshToken);

    // access token should verify with access secret
    const verified = jwt.verify(accessToken, TEST_JWT_SECRET) as any;
    expect(verified.id).toBe(payload.id);
    expect(verified.email).toBe(payload.email);
  });

  it("refreshAccessToken throws for invalid refresh token", async () => {
    await expect(authService.refreshAccessToken("invalid.refresh.token")).rejects.toThrow("Невалідний refresh токен");
  });
});

describe("AuthService - Registration & Login", () => {
  const TEST_JWT_SECRET = "test_secret";
  const TEST_JWT_REFRESH_SECRET = "test_refresh_secret";

  beforeAll(() => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    process.env.JWT_REFRESH_SECRET = TEST_JWT_REFRESH_SECRET;
    return import("../auth/auth-service").then(mod => {
      authService = mod.default;
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers a new user with valid credentials", async () => {
    userServiceMock.getUserByEmail.mockResolvedValueOnce(null);
    registrationRequestModelMock.findOne.mockResolvedValueOnce(null);
    registrationRequestModelMock.create.mockResolvedValueOnce({
      name: "John Doe",
      email: "john@example.com",
    });

    const result = await authService.registerRequest("John Doe", "john@example.com", "password123", "student");

    expect(result.message).toContain("очікує схвалення адміністратора");
    expect(registrationRequestModelMock.create).toHaveBeenCalled();
  });

  it("throws error if user already exists", async () => {
    const existingUser = { _id: "user1", email: "john@example.com", name: "John" };
    userServiceMock.getUserByEmail.mockResolvedValueOnce(existingUser);

    await expect(authService.registerRequest("John Doe", "john@example.com", "password123")).rejects.toThrow(
      "Користувач з таким email вже існує"
    );
  });

  it("throws error if registration request already submitted", async () => {
    userServiceMock.getUserByEmail.mockResolvedValueOnce(null);
    registrationRequestModelMock.findOne.mockResolvedValueOnce({
      email: "john@example.com",
      name: "John Doe",
    });

    await expect(authService.registerRequest("John Doe", "john@example.com", "password123")).rejects.toThrow(
      "Запит на реєстрацію для цього email вже подано"
    );
  });

  it("logs in user with valid email and password", async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const user = {
      _id: userId,
      name: "John Doe",
      email: "john@example.com",
      role: "student",
      password: "$2a$10$...", // bcrypt hash
      isArchived: false,
    };

    userServiceMock.getUserByEmail.mockResolvedValueOnce(user);

    const result = await authService.login("john@example.com", "password123");

    expect(result.user.email).toBe("john@example.com");
    expect(result.user.role).toBe("student");
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
  });

  it("throws error if user not found", async () => {
    userServiceMock.getUserByEmail.mockResolvedValueOnce(null);

    await expect(authService.login("nonexistent@example.com", "password123")).rejects.toThrow(
      "Невірний email або пароль"
    );
  });

  it("throws error if account is archived", async () => {
    const user = {
      _id: new mongoose.Types.ObjectId().toString(),
      name: "Archived User",
      email: "archived@example.com",
      role: "student",
      isArchived: true,
    };

    userServiceMock.getUserByEmail.mockResolvedValueOnce(user);

    await expect(authService.login("archived@example.com", "password123")).rejects.toThrow("Обліковий запис в архіві");
  });

  it("lists all registration requests", async () => {
    const requests = [
      { _id: "req1", name: "User1", email: "user1@example.com", requestedRole: "student" },
      { _id: "req2", name: "User2", email: "user2@example.com", requestedRole: "teacher" },
    ];

    registrationRequestModelMock.find.mockResolvedValueOnce(requests);

    const result = await authService.listRegistrationRequests();

    expect(result).toHaveLength(2);
    expect(result[0].requestedRole).toBe("student");
    expect(result[1].requestedRole).toBe("teacher");
  });

  it("approves a registration request and creates user", async () => {
    const requestId = new mongoose.Types.ObjectId().toString();
    const request = {
      _id: requestId,
      name: "New User",
      email: "newuser@example.com",
      passwordHash: "hashedpass",
      requestedRole: "student",
    };

    const newUser = {
      _id: new mongoose.Types.ObjectId().toString(),
      name: "New User",
      email: "newuser@example.com",
      role: "student",
    };

    registrationRequestModelMock.findById.mockResolvedValueOnce(request);
    userServiceMock.createUserWithHash.mockResolvedValueOnce(newUser);
    registrationRequestModelMock.findByIdAndDelete.mockResolvedValueOnce(request);

    const result = await authService.approveRegistrationRequest(requestId);

    expect(result.user.email).toBe("newuser@example.com");
    expect(result.user.role).toBe("student");
    expect(result.accessToken).toBeDefined();
    expect(registrationRequestModelMock.findByIdAndDelete).toHaveBeenCalledWith(requestId);
  });

  it("throws error if registration request not found", async () => {
    registrationRequestModelMock.findById.mockResolvedValueOnce(null);

    await expect(authService.approveRegistrationRequest("nonexistent")).rejects.toThrow("Запит на реєстрацію не знайдено");
  });

  it("deletes a registration request", async () => {
    const requestId = new mongoose.Types.ObjectId().toString();

    registrationRequestModelMock.findByIdAndDelete.mockResolvedValueOnce({ _id: requestId });

    const result = await authService.deleteRegistrationRequest(requestId);

    expect(result.message).toBe("Registration request deleted");
    expect(registrationRequestModelMock.findByIdAndDelete).toHaveBeenCalledWith(requestId);
  });

  it("resets password with valid token", async () => {
    const newPassword = "newpass123";
    const resetToken = "reset_token_xyz";

    const user = {
      _id: new mongoose.Types.ObjectId().toString(),
      email: "user@example.com",
      password: "oldhash",
      passwordResetToken: resetToken,
      passwordResetExpires: new Date(Date.now() + 60000), // 1 minute from now
      save: vi.fn(),
    };

    userModelMock.findOne.mockResolvedValueOnce(user);

    const result = await authService.resetPassword(resetToken, newPassword);

    expect(result.message).toBe("Password updated successfully");
    expect(user.save).toHaveBeenCalled();
    expect(user.passwordResetToken).toBeUndefined();
    expect(user.passwordResetExpires).toBeUndefined();
  });

  it("throws error for expired reset token", async () => {
    const resetToken = "expired_token";

    userModelMock.findOne.mockResolvedValueOnce(null);

    await expect(authService.resetPassword(resetToken, "newpass123")).rejects.toThrow(
      "Невалідний або прострочений токен скидання пароля"
    );
  });
});
