import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import { DISPLAY_NAME_MAX_LENGTH } from "@desmoche/shared";
import { AuthError } from "../auth/errors";
import { requestOtp, verifyOtp } from "../auth/authService";
import { createGuestPlayerId } from "../auth/guestId";
import { signAuthToken } from "../auth/jwt";

function errorMessage(err: unknown): string {
  return err instanceof AuthError || err instanceof Error ? err.message : "Error desconocido";
}

export function createAuthRouter(prisma: PrismaClient): Router {
  const router = Router();

  /**
   * "Jugar ahora": a fully temporary session, no email, no OTP, no row ever
   * written to the User table. Same JWT shape and the exact same socket
   * auth middleware as a real account — verifyAuthToken never touches the
   * database either way, so this needed no changes there. The only place
   * that has to know a player is a guest is persistence, which filters
   * guest seats out before writing (see persistence/handHistory.ts) since
   * HandHistoryPlayer has a hard foreign key to a real User row.
   */
  router.post("/guest", (req, res) => {
    const { displayName } = req.body as { displayName?: string };
    const trimmed = displayName?.trim().slice(0, DISPLAY_NAME_MAX_LENGTH);
    if (!trimmed) {
      res.status(400).json({ message: "Nombre requerido" });
      return;
    }
    const userId = createGuestPlayerId();
    const token = signAuthToken({ userId, email: "", displayName: trimmed });
    res.json({
      token,
      user: { id: userId, email: "", displayName: trimmed, chipBalance: 0 },
    });
  });

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
