import { PrismaClient } from "@prisma/client";

/** Single shared client for the running process. Tests build their own, pointed at a throwaway database. */
export const prisma = new PrismaClient();
