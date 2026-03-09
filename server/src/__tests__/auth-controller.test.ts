/// <reference types="vitest" />
import { describe, it, expect, beforeAll } from "vitest";
import jwt from "jsonwebtoken";
let authController: any;

function createMockRes() {
  const res: any = {};
  res.statusCode = 200;
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.jsonBody = null;
  res.json = (body: any) => { res.jsonBody = body; return res; };
  res.cookie = () => res;
  res.clearCookie = () => res;
  return res;
}

describe("AuthController.refresh", () => {
  const TEST_JWT_REFRESH_SECRET = "test_refresh_secret";
  const TEST_JWT_SECRET = "test_secret";
  beforeAll(async () => {
    process.env.JWT_REFRESH_SECRET = TEST_JWT_REFRESH_SECRET;
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    const mod = await import("../auth/auth-controller");
    authController = mod.default;
  });

  it("returns new accessToken when refreshToken cookie is valid", async () => {
    const refreshToken = jwt.sign({ id: "user1", email: "u@example.com" }, TEST_JWT_REFRESH_SECRET, { expiresIn: "7d" });
    const req: any = { cookies: { refreshToken } };
    const res = createMockRes();

    await authController.refresh(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody?.success).toBe(true);
    const accessToken = res.jsonBody?.data?.accessToken;
    const verified = jwt.verify(accessToken, TEST_JWT_SECRET) as any;
    expect(verified.id).toBe("user1");
    expect(verified.email).toBe("u@example.com");
  });

  it("returns 401 when refreshToken cookie is missing", async () => {
    const req: any = { cookies: {} };
    const res = createMockRes();

    await authController.refresh(req, res);
    expect(res.statusCode).toBe(401);
    expect(res.jsonBody?.success).toBe(false);
  });
});
