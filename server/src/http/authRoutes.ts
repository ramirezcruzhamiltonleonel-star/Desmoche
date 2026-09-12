import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import { AuthError } from "../auth/errors";
import { requestOtp, verifyOtp } from "../auth/authService";

function errorMessage(err: unknown): string {
  return err instanceof AuthError || err instanceof Error ? err.message : "Error desconocido";
}

export function createAuthRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.post("/request-code", async (req, res) => {
    try {
      const { email } = req.body as { email?: string };
      if (!email) throw new AuthError("Correo requerido");
      const result = await requestOtp(prisma, email);
      res.json(result);
    } catch (err) {
      res.status(400).json({ message: errorMessage(err) });
    }
  });

  router.post("/verify-code", async (req, res) => {
    try {
      const { email, code, displayName } = req.body as {
        email?: string;
        code?: string;
        displayName?: string;
      };
      if (!email || !code) throw new AuthError("Correo y código requeridos");
      const { token, user } = await verifyOtp(prisma, email, code, displayName);
      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          chipBalance: user.chipBalance,
        },
      });
    } catch (err) {
      res.status(400).json({ message: errorMessage(err) });
    }
  });

  return router;
}
