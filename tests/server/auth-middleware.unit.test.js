/**
 * @jest-environment node
 */

import { describe, expect, jest, test } from "@jest/globals";
import jwt from "jsonwebtoken";

process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/pokecollect";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { requireAuth } = await import("../../server/middleware/auth.js");

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe("requireAuth middleware", () => {
  test("returns 401 when bearer token is missing", () => {
    const req = { headers: {} };
    const res = createMockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "Missing bearer token" });
    expect(next).not.toHaveBeenCalled();
  });

  test("returns 401 when bearer token is invalid", () => {
    const req = { headers: { authorization: "Bearer not-a-real-token" } };
    const res = createMockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "Invalid or expired token" });
    expect(next).not.toHaveBeenCalled();
  });

  test("attaches auth payload and calls next for valid token", () => {
    const token = jwt.sign(
      { sub: "user-1", email: "trainer@example.com" },
      process.env.JWT_SECRET
    );

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = createMockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.auth).toEqual({
      userId: "user-1",
      email: "trainer@example.com",
    });
  });
});
