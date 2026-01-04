import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { requireEnv } from '../config/env.js';
import { prisma } from '../services/prisma.js';

const router = Router();

const loginSchema = z.object({
  username: z.string({ required_error: 'ต้องระบุชื่อผู้ใช้' }).trim().min(1, 'ต้องระบุชื่อผู้ใช้'),
  password: z.string({ required_error: 'ต้องระบุรหัสผ่าน' }).min(1, 'ต้องระบุรหัสผ่าน')
});

router.post('/login', async (req, res, next) => {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: {
        message: 'ข้อมูลเข้าสู่ระบบไม่ถูกต้อง',
        details: parseResult.error.flatten()
      }
    });
  }

  const { username, password } = parseResult.data;

  try {
    const user = await prisma.user.findUnique({
      where: { username },
      include: { role: true }
    });

    if (!user || !user.role) {
      return res.status(401).json({ error: { message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' } });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: { message: 'บัญชีนี้ถูกปิดใช้งาน' } });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: { message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' } });
    }

    const secret = requireEnv('JWT_SECRET');
    const expiresIn = process.env.JWT_EXPIRES_IN || '1h';

    const token = jwt.sign(
      {
        sub: user.id,
        role: user.role.name,
        displayName: user.displayName || user.username
      },
      secret,
      { expiresIn }
    );

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    return res.json({
      token,
      tokenType: 'Bearer',
      expiresIn,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role.name,
        lastLoginAt: user.lastLoginAt
      }
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
