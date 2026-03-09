/// <reference types="vitest" />
import { describe, it, expect, vi, beforeAll } from "vitest";
import jwt from "jsonwebtoken";
let authMiddleware: any;

function createMockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("authMiddleware", () => {
  const TEST_JWT_SECRET = "test_secret";
  beforeAll(async () => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    const mod = await import("../middleware/auth.middleware");
    authMiddleware = mod.authMiddleware;
  });

  it("returns 401 when Authorization header is missing", () => {
    const req: any = { headers: {} };
    const res = createMockRes();
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when Authorization uses lowercase bearer", () => {
    const token = jwt.sign({ id: "1", email: "a@b.com" }, TEST_JWT_SECRET);
    const req: any = { headers: { authorization: `bearer ${token}` } };
    const res = createMockRes();
    const next = vi.fn();

    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() and sets req.userId/email for valid Bearer token", () => {
    const token = jwt.sign({ id: "user1", email: "u@example.com" }, TEST_JWT_SECRET);
    const req: any = { headers: { authorization: `Bearer ${token}` } };
    const res = createMockRes();
    const next = vi.fn();

    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.userId).toBe("user1");
    expect(req.email).toBe("u@example.com");
  });
});
