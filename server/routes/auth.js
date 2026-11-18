import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";

const router = Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function createToken(userId) {
  return jwt.sign({}, process.env.JWT_SECRET, {
    subject: userId,
    expiresIn: "7d",
  });
}

router.post("/register", async (req, res, next) => {
  const email = typeof req.body.email === "string"
    ? req.body.email.trim().toLowerCase()
    : "";
  const password = req.body.password;

  if (!emailPattern.test(email) || typeof password !== "string" || password.length < 8) {
    return res.status(400).json({
      error: "Enter a valid email and a password of at least 8 characters.",
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword },
      select: { id: true, email: true },
    });

    return res.status(201).json({
      token: createToken(user.id),
      user,
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ error: "An account with that email already exists." });
    }
    return next(error);
  }
});

router.post("/login", async (req, res, next) => {
  const email = typeof req.body.email === "string"
    ? req.body.email.trim().toLowerCase()
    : "";
  const password = req.body.password;

  if (!emailPattern.test(email) || typeof password !== "string") {
    return res.status(400).json({ error: "Enter a valid email and password." });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    const passwordMatches = user && await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      return res.status(401).json({ error: "Email or password is incorrect." });
    }

    return res.json({
      token: createToken(user.id),
      user: { id: user.id, email: user.email },
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
