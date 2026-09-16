import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import { verifyAuthToken } from "../auth/jwt";
import { getUserStats } from "../persistence/userStats";

/** Every route here requires a valid `Authorization: Bearer <token>` — unlike /auth, which is deliberately public. */
export function createStatsRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get("/me/stats", async (req, res) => {
    try {
      const header = req.headers.authorization;
      const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
      if (!token) {
        res.status(401).json({ message: "Falta el token de autenticación" });
        return;
      }
      const { userId } = verifyAuthToken(token);
      const stats = await getUserStats(prisma, userId);
      res.json(stats);
    } catch {
      res.status(401).json({ message: "No autorizado" });
    }
  });

  return router;
}
