/// <reference types="vitest" />
import { describe, it, expect, beforeAll, vi } from "vitest";

// Hoisted mocks must be declared at top-level
const rrMock: any = { findOne: vi.fn(), create: vi.fn(), findById: vi.fn(), findByIdAndDelete: vi.fn() };
const usMock: any = { getUserByEmail: vi.fn(), createUserWithHash: vi.fn() };
vi.mock("../auth/registration-request-model", () => ({ default: rrMock }));
vi.mock("../user/user-service", () => ({ default: usMock }));

describe("Registration Flow (service)", () => {
  const TEST_JWT_SECRET = "test_secret";
  const TEST_JWT_REFRESH_SECRET = "test_refresh_secret";

  beforeAll(() => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    process.env.JWT_REFRESH_SECRET = TEST_JWT_REFRESH_SECRET;
  });

  it("registerRequest stores a new request when email not used", async () => {
    usMock.getUserByEmail.mockResolvedValueOnce(null);
    rrMock.findOne.mockResolvedValueOnce(null);
    rrMock.create.mockResolvedValueOnce({});

    const mod = await import("../auth/auth-service");
    const authService = mod.default;

    const res = await authService.registerRequest("John", "john@example.com", "pwd", "student");
    expect(usMock.getUserByEmail).toHaveBeenCalledWith("john@example.com");
    expect(rrMock.findOne).toHaveBeenCalledWith({ email: "john@example.com" });
    expect(rrMock.create).toHaveBeenCalled();
    expect(res.message).toContain("pending admin approval");
  });

  it("approveRegistrationRequest creates user, deletes request, and returns tokens", async () => {
    const req = { _id: "req1", name: "Jane", email: "jane@example.com", passwordHash: "hash", requestedRole: "teacher" };
    rrMock.findById.mockResolvedValueOnce(req);
    rrMock.findByIdAndDelete.mockResolvedValueOnce({});
    const user = { _id: "u1", name: "Jane", email: "jane@example.com", role: "teacher" };
    usMock.createUserWithHash.mockResolvedValueOnce(user);

    const mod = await import("../auth/auth-service");
    const authService = mod.default;

    const result = await authService.approveRegistrationRequest("req1");
    expect(usMock.createUserWithHash).toHaveBeenCalledWith("Jane", "jane@example.com", "hash", "teacher");
    expect(rrMock.findByIdAndDelete).toHaveBeenCalledWith("req1");
    expect(result.user.role).toBe("teacher");
    expect(result.accessToken).toBeTypeOf("string");
    expect(result.refreshToken).toBeTypeOf("string");
  });

  it("deleteRegistrationRequest removes request", async () => {
    rrMock.findByIdAndDelete.mockResolvedValueOnce({});
    const mod = await import("../auth/auth-service");
    const authService = mod.default;
    const res = await authService.deleteRegistrationRequest("req2");
    expect(rrMock.findByIdAndDelete).toHaveBeenCalledWith("req2");
    expect(res.message).toContain("deleted");
  });
});
