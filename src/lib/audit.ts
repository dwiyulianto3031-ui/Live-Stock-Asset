import { db } from "@/db";
import { auditLogs } from "@/db/schema";

export type AuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "EXPORT"
  | "IMPORT"
  | "ADJUST"
  | "STOCK_IN"
  | "STOCK_OUT";

export async function logAudit(params: {
  userId?: number | null;
  userName?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: number | null;
  description?: string | null;
  metadata?: any;
  ipAddress?: string | null;
}): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: params.userId ?? null,
      userName: params.userName ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      description: params.description ?? null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      ipAddress: params.ipAddress ?? null,
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}
