import { z } from "zod";

/**
 * Contrato do agente local (packages/local-agent/scanner.py) com a API.
 * Qualquer mudança aqui precisa ser feita também no agente e no README dele.
 */

const shortText = z.string().max(500);
const nullableShortText = shortText.nullable();

export const severitySchema = z.enum(["info", "low", "medium", "high", "critical"]);

const serviceSchema = z.object({
  port: z.number().int().min(1).max(65535),
  protocol: z.literal("tcp"),
  name: z.string().max(64),
  banner: nullableShortText,
});

const deviceSchema = z.object({
  ip: z.string().max(64),
  mac: z.string().max(64).nullable(),
  vendor: z.string().max(128).nullable(),
  hostname: nullableShortText,
  model: nullableShortText,
  openPorts: z.array(z.number().int().min(1).max(65535)).max(100),
  services: z.array(serviceSchema).max(100),
});

const findingSchema = z.object({
  severity: severitySchema,
  kind: z.string().max(64).regex(/^[a-z0-9_]+$/),
  title: shortText,
  detail: shortText,
  recommendation: shortText,
  deviceIp: z.string().max(64).nullable(),
  port: z.number().int().min(1).max(65535).nullable(),
});

/** Correção aplicada pelo agente, com confirmação do usuário, nesta execução. */
const fixSchema = z.object({
  kind: z.string().max(64).regex(/^[a-z0-9_]+$/),
  target: z.enum(["computer", "router"]),
  title: z.string().max(200),
  appliedAt: z.iso.datetime({ offset: true }),
  /** Achado que a correção resolveu. */
  findingKind: z.string().max(64).regex(/^[a-z0-9_]+$/).optional(),
});

export const scanPayloadSchema = z
  .object({
    agentVersion: z.string().max(32),
    mode: z.enum(["home", "public"]),
    startedAt: z.iso.datetime({ offset: true }),
    finishedAt: z.iso.datetime({ offset: true }),
    host: z.object({
      os: z.enum(["windows", "macos", "linux"]),
      hostname: shortText,
    }),
    network: z.object({
      localIp: z.string().max(64).nullable(),
      cidr: z.string().max(64).nullable(),
      gateway: z.string().max(64).nullable(),
      isPrivate: z.boolean(),
      wifiSecurity: z.string().max(64).nullable(),
    }),
    devices: z.array(deviceSchema).max(256),
    findings: z.array(findingSchema).max(500),
    fixes: z.array(fixSchema).max(50).default([]),
  })
  .refine((scan) => scan.mode === "home" || scan.devices.length === 0, {
    message: "No modo rede pública o agente não pode enviar dispositivos de terceiros",
    path: ["devices"],
  });

export type ScanPayload = z.infer<typeof scanPayloadSchema>;
export type ScanFix = z.infer<typeof fixSchema>;
export type FindingSeverity = z.infer<typeof severitySchema>;
