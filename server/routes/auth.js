import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db/pool.js";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

function createToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, env.jwtSecret, {
    expiresIn: "7d",
  });
}

function sanitizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

authRouter.post("/register", async (req, res) => {
  const email = sanitizeEmail(req.body.email);
  const password = req.body.password || "";

  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: "Email and password (min 8 chars) are required" });
  }

  const hash = await bcrypt.hash(password, 12);

  try {
    const result = await pool.query(
      `
        INSERT INTO users(email, password_hash)
        VALUES ($1, $2)
        RETURNING id, email, created_at
      `,
      [email, hash]
    );

    const user = result.rows[0];
    const token = createToken(user);
    return res.status(201).json({ token, user: { id: user.id, email: user.email } });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Email already registered" });
    }
    console.error(err);
    return res.status(500).json({ error: "Failed to register" });
  }
});

authRouter.post("/login", async (req, res) => {
  const email = sanitizeEmail(req.body.email);
  const password = req.body.password || "";

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const result = await pool.query(
    "SELECT id, email, password_hash FROM users WHERE email = $1",
    [email]
  );

  const user = result.rows[0];
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = createToken(user);
  return res.json({ token, user: { id: user.id, email: user.email } });
});

authRouter.post("/logout", (_req, res) => {
  return res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const result = await pool.query(
    "SELECT id, email, created_at FROM users WHERE id = $1",
    [req.auth.userId]
  );

  if (!result.rows[0]) {
    return res.status(404).json({ error: "User not found" });
  }

  return res.json({ user: result.rows[0] });
});
