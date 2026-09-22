import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import { verifyAuthToken } from "../auth/jwt";
import { getUserStats } from "../persistence/userStats";
import { claimDailyMission, getDailyProgress } from "../persistence/dailyProgress";

function requireUserId(req: { headers: { authorization?: string | undefined } }): string {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
  if (!token) throw new Error("Falta el token de autenticación");
  return verifyAuthToken(token).userId;
}

/** Every route here requires a valid `Authorization: Bearer <token>` — unlike /auth, which is deliberately public. */
export function createStatsRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get("/me/stats", async (req, res) => {
    try {
      const userId = requireUserId(req);
      const stats = await getUserStats(prisma, userId);
      res.json(stats);
    } catch {
      res.status(401).json({ message: "No autorizado" });
    }
  });

  router.get("/me/daily", async (req, res) => {
    try {
      const userId = requireUserId(req);
      const progress = await getDailyProgress(prisma, userId);
      res.json(progress);
    } catch {
      res.status(401).json({ message: "No autorizado" });
    }
  });

  // POST, not folded into the GET above — claiming is a real state change
  // (awards chips, marks the day claimed), so it stays an explicit action
  // the client only calls once it's seen canClaim: true, not a side effect
  // of merely checking progress.
  router.post("/me/daily/claim", async (req, res) => {
    try {
      const userId = requireUserId(req);
      const result = await claimDailyMission(prisma, userId);
      if (!result) {
        res.status(409).json({ message: "La misión de hoy no está lista para reclamar, o ya se reclamó." });
        return;
      }
      res.json(result);
    } catch {
      res.status(401).json({ message: "No autorizado" });
    }
  });

  return router;
}
