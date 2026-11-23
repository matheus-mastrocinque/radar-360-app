import type { FastifyInstance } from "fastify";
import type { Db } from "../../shared/db.js";
import { requirePairingToken } from "../../shared/auth.js";
import { scanPayloadSchema, type FindingSeverity } from "./schema.js";

const SEVERITY_TO_DB = {
  info: "INFO",
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
  critical: "CRITICAL",
} as const satisfies Record<FindingSeverity, string>;

export async function networkRoutes(app: FastifyInstance, opts: { db: Db }) {
  const { db } = opts;

  app.post(
    "/network/scans",
    {
      bodyLimit: 1024 * 1024,
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const pairing = await requirePairingToken(db, request);
      const scan = scanPayloadSchema.parse(request.body);

      const created = await db.$transaction(async (tx) => {
        const record = await tx.networkScan.create({
          data: {
            userId: pairing.userId,
            mode: scan.mode === "home" ? "HOME" : "PUBLIC",
            agentVersion: scan.agentVersion,
            hostOs: scan.host.os,
            startedAt: new Date(scan.startedAt),
            finishedAt: new Date(scan.finishedAt),
            network: scan.network,
            devices: scan.devices,
            findings: {
              create: scan.findings.map((finding) => ({
                severity: SEVERITY_TO_DB[finding.severity],
                kind: finding.kind,
                title: finding.title,
                detail: finding.detail,
                recommendation: finding.recommendation,
                deviceIp: finding.deviceIp,
                port: finding.port,
              })),
            },
          },
        });
        await tx.pairingToken.update({
          where: { id: pairing.id },
          data: { lastUsedAt: new Date() },
        });
        return record;
      });

      const bySeverity = scan.findings.reduce<Record<string, number>>((acc, finding) => {
        acc[finding.severity] = (acc[finding.severity] ?? 0) + 1;
        return acc;
      }, {});

      return reply.code(201).send({
        scanId: created.id,
        devices: scan.devices.length,
        findings: scan.findings.length,
        bySeverity,
      });
    },
  );
}
