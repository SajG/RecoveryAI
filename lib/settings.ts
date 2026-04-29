import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type DecimalLike = { toNumber: () => number } | number;

function toNumber(value: DecimalLike): number {
  return typeof value === "number" ? value : value.toNumber();
}

export type AppSettingsResponse = {
  id: string;
  companyName: string;
  ownerEmail: string;
  timezone: string;
  currency: string;
  priorityCriticalOutstanding: number;
  priorityCriticalOverdueDays: number;
  priorityHighOutstanding: number;
  priorityHighOverdueDays: number;
  priorityMediumOutstanding: number;
  priorityMediumOverdueDays: number;
  bridgeEndpointUrl: string;
  bridgeSecret: string | null;
  tallyUrl: string;
  syncSchedule: string;
  aiApiKey: string | null;
  aiModel: string;
  aiAutoRegenerateFrequency: string;
  aiMaxRecommendationsPerDay: number;
  notificationDigest: string;
  whatsappAlertsNumber: string | null;
  alertOnCriticalParty: boolean;
  alertOnSyncFail: boolean;
  alertOnTargetMiss: boolean;
};

export async function getOrCreateSettings() {
  const existing = await prisma.setting.findUnique({ where: { id: "default" } });
  if (existing) return existing;
  try {
    return await prisma.setting.create({ data: { id: "default" } });
  } catch (error) {
    // Concurrent first requests can both pass findUnique; second create hits unique on `id`.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const row = await prisma.setting.findUnique({ where: { id: "default" } });
      if (row) return row;
    }
    throw error;
  }
}

export function serializeSettings(settings: Awaited<ReturnType<typeof getOrCreateSettings>>): AppSettingsResponse {
  return {
    id: settings.id,
    companyName: settings.companyName,
    ownerEmail: settings.ownerEmail,
    timezone: settings.timezone,
    currency: settings.currency,
    priorityCriticalOutstanding: toNumber(settings.priorityCriticalOutstanding),
    priorityCriticalOverdueDays: settings.priorityCriticalOverdueDays,
    priorityHighOutstanding: toNumber(settings.priorityHighOutstanding),
    priorityHighOverdueDays: settings.priorityHighOverdueDays,
    priorityMediumOutstanding: toNumber(settings.priorityMediumOutstanding),
    priorityMediumOverdueDays: settings.priorityMediumOverdueDays,
    bridgeEndpointUrl: settings.bridgeEndpointUrl,
    bridgeSecret: settings.bridgeSecret,
    tallyUrl: settings.tallyUrl,
    syncSchedule: settings.syncSchedule,
    aiApiKey: settings.aiApiKey,
    aiModel: settings.aiModel,
    aiAutoRegenerateFrequency: settings.aiAutoRegenerateFrequency,
    aiMaxRecommendationsPerDay: settings.aiMaxRecommendationsPerDay,
    notificationDigest: settings.notificationDigest,
    whatsappAlertsNumber: settings.whatsappAlertsNumber,
    alertOnCriticalParty: settings.alertOnCriticalParty,
    alertOnSyncFail: settings.alertOnSyncFail,
    alertOnTargetMiss: settings.alertOnTargetMiss,
  };
}
