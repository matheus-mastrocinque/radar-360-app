/**
 * Popula o banco com dados 100% sintéticos para desenvolvimento e para a demo do júri:
 * - persona fictícia com e-mail, CPF e telefone já verificados;
 * - três vazamentos de empresas fictícias, com identificadores aleatórios guardados só como HMAC;
 * - duas auditorias de rede fictícias (casa e rede pública), para o painel da demo;
 * - um token de pareamento para testar o agente local.
 * Regra do regulamento (item 6.9): nada aqui pode ser dado real de terceiros.
 */
import type { AssetType, Prisma } from "../src/generated/prisma/client.js";
import { loadEnv } from "../src/config/env.js";
import { createDb } from "../src/shared/db.js";
import {
  completeCpf,
  generatePairingToken,
  hashToken,
  hmacIdentifier,
  maskIdentifier,
  normalizeIdentifier,
} from "../src/shared/crypto.js";
import { runBreachCheck } from "../src/modules/breaches/job.js";
import { importHibpCatalog } from "../src/modules/breaches/hibp.js";

const env = loadEnv();
const db = createDb(env.DATABASE_URL);

const NOW = Date.now();
const HOUR = 60 * 60 * 1000;
const hoursAgo = (hours: number) => new Date(NOW - hours * HOUR);

const PERSONA = {
  email: "demo@example.com",
  name: "Ana Demo (persona fictícia)",
  identifiers: [
    { type: "EMAIL", value: "demo@example.com" },
    { type: "CPF", value: "123.456.789-09" },
    { type: "PHONE", value: "(11) 90000-0001" },
  ] satisfies Array<{ type: AssetType; value: string }>,
};

const BREACHES = [
  {
    slug: "teleconecta-2025",
    company: "TeleConecta Telecom (fictícia)",
    occurredAt: new Date("2025-08-14"),
    disclosedAt: new Date("2025-09-02"),
    dataClasses: ["nome", "cpf", "telefone", "endereco"],
    description:
      "Base de clientes de uma operadora fictícia publicada em fórum. Incidente sintético para demonstração.",
    recordTypes: ["CPF", "PHONE"] as AssetType[],
    persona: ["CPF", "PHONE"] as AssetType[],
    detectedAt: new Date("2025-09-03T13:00:00Z"),
    // .invalid é reservado: o contato do encarregado nunca chega a ninguém de verdade.
    dpoContact: "encarregado@teleconecta.invalid",
  },
  {
    slug: "lojafacil-2026",
    company: "LojaFácil Marketplace (fictícia)",
    occurredAt: new Date("2026-03-20"),
    disclosedAt: new Date("2026-04-11"),
    dataClasses: ["nome", "email", "senha_hash", "historico_compras"],
    description:
      "Credenciais de clientes de um marketplace fictício vendidas em canal clandestino. Incidente sintético.",
    recordTypes: ["EMAIL"] as AssetType[],
    persona: ["EMAIL"] as AssetType[],
    detectedAt: new Date("2026-04-12T09:30:00Z"),
    dpoContact: "privacidade@lojafacil.invalid",
  },
  {
    slug: "clinica-vida-2026",
    company: "Clínica Vida+ (fictícia)",
    occurredAt: new Date("2026-10-05"),
    disclosedAt: null,
    dataClasses: ["nome", "cpf", "data_nascimento", "email", "convenio"],
    description:
      "Cadastro de pacientes de uma rede de clínicas fictícia exposto por servidor mal configurado. Incidente sintético.",
    recordTypes: ["CPF", "EMAIL"] as AssetType[],
    persona: ["CPF", "EMAIL"] as AssetType[],
    // Detectado há 2 dias: aparece como "novo" no painel.
    detectedAt: hoursAgo(48),
    dpoContact: "dpo@clinicavida.invalid",
  },
];

const REC_SMB =
  "Em rede pública, marque a conexão como 'Rede pública' no Windows (Configurações > Rede e " +
  "Internet > propriedades da rede) e desative 'Compartilhamento de arquivos e impressoras'. Se " +
  "nunca compartilha pastas, desative o serviço 'Servidor' (LanmanServer).";

/**
 * Auditorias de rede fictícias da persona, no mesmo formato que o agente local envia.
 * Os MACs começam com 02: (endereço administrado localmente), então não apontam para nenhum fabricante real.
 */
const DEMO_SCANS: Array<Omit<Prisma.NetworkScanCreateInput, "user">> = [
  {
    mode: "HOME",
    agentVersion: "0.1.0",
    hostOs: "windows",
    startedAt: hoursAgo(26),
    finishedAt: new Date(hoursAgo(26).getTime() + 47_000),
    network: {
      localIp: "192.168.0.12",
      cidr: "192.168.0.0/24",
      gateway: "192.168.0.1",
      isPrivate: true,
      wifiSecurity: "WPA2-Personal",
    },
    devices: [
      { ip: "192.168.0.1", mac: "02:00:5e:10:00:01", vendor: null, hostname: "roteador.lan", model: "Roteador Wi-Fi", openPorts: [23, 53, 80, 1900], services: [] },
      { ip: "192.168.0.23", mac: "02:00:5e:10:00:23", vendor: null, hostname: null, model: "Câmera IP", openPorts: [80], services: [] },
      { ip: "192.168.0.31", mac: "02:00:5e:10:00:31", vendor: null, hostname: "smart-tv-sala", model: "Smart TV", openPorts: [8008], services: [] },
      { ip: "192.168.0.40", mac: "02:00:5e:10:00:40", vendor: null, hostname: "impressora", model: "Impressora multifuncional", openPorts: [631, 9100], services: [] },
      { ip: "192.168.0.57", mac: "02:00:5e:10:00:57", vendor: null, hostname: null, model: null, openPorts: [], services: [] },
    ],
    // Correção que a persona aceitou no agente: o Telnet e o painel continuam (exigem o painel do
    // roteador), mas a porta que um app abriu para a Internet via UPnP foi fechada.
    fixes: [
      {
        kind: "upnp_mapping_removed",
        target: "router",
        title: "Porta 3389 (Área de Trabalho Remota) fechada para a Internet no roteador, via UPnP",
        appliedAt: new Date(hoursAgo(26).getTime() + 52_000).toISOString(),
        findingKind: "upnp_port_mapping",
      },
    ],
    findings: {
      create: [
        {
          severity: "HIGH",
          kind: "telnet_open",
          title: "Telnet aberto (acesso sem criptografia)",
          detail:
            "O roteador 192.168.0.1 aceita conexões Telnet na porta 23. Senhas e comandos trafegam sem criptografia, e o Telnet é o alvo preferido de botnets como a Mirai.",
          recommendation:
            "Desative o Telnet no painel do aparelho (ou peça ao fabricante/provedor). Use SSH se precisar de acesso remoto e troque a senha padrão.",
          deviceIp: "192.168.0.1",
          port: 23,
        },
        {
          severity: "MEDIUM",
          kind: "camera_admin_http",
          title: "Painel web de câmera sem HTTPS",
          detail:
            "O dispositivo 192.168.0.23 exibe um painel web via HTTP na porta 80. Senhas digitadas nele trafegam sem criptografia.",
          recommendation:
            "Troque a senha padrão, atualize o firmware e não redirecione essa porta para a Internet. Prefira o acesso pelo app oficial do fabricante.",
          deviceIp: "192.168.0.23",
          port: 80,
        },
        {
          severity: "LOW",
          kind: "router_admin_http",
          title: "Painel do roteador acessível sem HTTPS",
          detail:
            "O roteador 192.168.0.1 exibe o painel de administração via HTTP na porta 80. A senha do painel trafega sem criptografia na rede local.",
          recommendation:
            "Troque a senha padrão do painel por uma forte, desative o 'gerenciamento remoto' e use HTTPS se o roteador oferecer.",
          deviceIp: "192.168.0.1",
          port: 80,
        },
        {
          severity: "LOW",
          kind: "upnp_enabled",
          title: "UPnP ativo no roteador",
          detail:
            "O roteador 192.168.0.1 responde à descoberta UPnP e anuncia o serviço de gateway (IGD). Com isso, programas e aparelhos da rede podem abrir portas para a Internet automaticamente, sem você saber.",
          recommendation:
            "Se não usa consoles/jogos online que dependem disso, desative o UPnP no painel do roteador (geralmente em 'Avançado' > 'UPnP').",
          deviceIp: "192.168.0.1",
          port: null,
        },
        {
          severity: "LOW",
          kind: "printer_raw_port",
          title: "Impressora aceita trabalhos sem autenticação",
          detail:
            "O dispositivo 192.168.0.40 tem a porta 9100 (impressão direta) aberta: qualquer aparelho da rede pode enviar trabalhos de impressão.",
          recommendation: "Desative a impressão direta (RAW/JetDirect) se não usa e atualize o firmware.",
          deviceIp: "192.168.0.40",
          port: 9100,
        },
        {
          severity: "INFO",
          kind: "http_service",
          title: "Serviço web sem HTTPS",
          detail: "O dispositivo 192.168.0.31 responde a HTTP na porta 8008.",
          recommendation:
            "Se for um painel de configuração, troque a senha padrão e mantenha o aparelho atualizado.",
          deviceIp: "192.168.0.31",
          port: 8008,
        },
      ],
    },
  },
  {
    mode: "PUBLIC",
    agentVersion: "0.1.0",
    hostOs: "windows",
    startedAt: hoursAgo(74),
    finishedAt: new Date(hoursAgo(74).getTime() + 6_000),
    network: {
      localIp: "10.42.0.37",
      cidr: null,
      gateway: "10.42.0.1",
      isPrivate: true,
      wifiSecurity: "WPA2-Personal",
    },
    devices: [],
    // Correções que a persona aceitou, uma a uma, no Wi-Fi do café.
    fixes: [
      {
        kind: "firewall_enabled",
        target: "computer",
        title: "Firewall ativado no perfil Público",
        appliedAt: new Date(hoursAgo(74).getTime() + 9_000).toISOString(),
        findingKind: "firewall_disabled",
      },
      {
        kind: "network_set_public",
        target: "computer",
        title: "Wi-Fi do café passou para o perfil de rede Público",
        appliedAt: new Date(hoursAgo(74).getTime() + 11_000).toISOString(),
        findingKind: "network_marked_private",
      },
    ],
    findings: {
      create: [
        {
          severity: "MEDIUM",
          kind: "exposed_smb",
          title: "Compartilhamento de arquivos SMB pode estar exposto (porta 445)",
          detail:
            "A porta 445/TCP deste computador aceita conexões em todas as interfaces de rede. Programa: System. O firewall está ativo: o acesso só acontece se existir uma regra liberando esta porta, por isso vale conferir.",
          recommendation: REC_SMB,
          deviceIp: null,
          port: 445,
        },
        {
          severity: "LOW",
          kind: "hostname_reveals_identity",
          title: "Nome do computador pode revelar sua identidade",
          detail:
            "O nome 'NOTEBOOK-ANA' é anunciado para a rede (DHCP, compartilhamento, AirDrop/Bonjour) e parece conter um nome pessoal. Em redes públicas, isso ajuda estranhos a saber de quem é o aparelho.",
          recommendation:
            "Use um nome neutro, sem seu nome (ex.: 'notebook-01'). Windows: Configurações > Sistema > Sobre > Renomear este PC. macOS: Ajustes > Geral > Sobre > Nome.",
          deviceIp: null,
          port: null,
        },
        {
          severity: "INFO",
          kind: "firewall_enabled",
          title: "Firewall ativo",
          detail: "O firewall do sistema está ativo e bloqueia conexões de entrada não autorizadas.",
          recommendation: "Mantenha-o ativo e evite criar exceções para programas que você não reconhece.",
          deviceIp: null,
          port: null,
        },
      ],
    },
  },
];

const RECORDS_PER_TYPE = 300;

/** PRNG determinístico para o seed gerar sempre os mesmos dados. */
function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomDigits(random: () => number, length: number): string {
  return Array.from({ length }, () => Math.floor(random() * 10)).join("");
}

function syntheticIdentifier(type: AssetType, index: number, random: () => number): string {
  switch (type) {
    case "CPF":
      return completeCpf(randomDigits(random, 9));
    case "EMAIL":
      // .invalid é um domínio reservado: nunca pertence a ninguém.
      return `usuario${index}@exemplo.invalid`;
    case "PHONE":
      return `55${String(11 + Math.floor(random() * 88))}9${randomDigits(random, 8)}`;
  }
}

function hmacOf(type: AssetType, value: string): string {
  return hmacIdentifier(env.HMAC_SECRET, type, normalizeIdentifier(type, value));
}

async function main() {
  const user = await db.user.upsert({
    where: { email: PERSONA.email },
    update: { name: PERSONA.name, isDemo: true },
    create: { email: PERSONA.email, name: PERSONA.name, isDemo: true },
  });

  for (const { type, value } of PERSONA.identifiers) {
    const normalized = normalizeIdentifier(type, value);
    const hmac = hmacIdentifier(env.HMAC_SECRET, type, normalized);
    await db.asset.upsert({
      where: { type_hmac: { type, hmac } },
      update: { userId: user.id, verifiedAt: new Date() },
      create: {
        userId: user.id,
        type,
        hmac,
        masked: maskIdentifier(type, normalized),
        verifiedAt: new Date(),
      },
    });
  }

  for (const [breachIndex, spec] of BREACHES.entries()) {
    const { recordTypes, persona, detectedAt: _detectedAt, ...data } = spec;
    const breach = await db.breach.upsert({
      where: { slug: spec.slug },
      update: data,
      create: { ...data, isSynthetic: true },
    });

    const random = mulberry32(1000 + breachIndex);
    const records: Array<{ breachId: string; assetType: AssetType; hmac: string }> = [];
    for (const type of recordTypes) {
      for (let i = 0; i < RECORDS_PER_TYPE; i++) {
        records.push({
          breachId: breach.id,
          assetType: type,
          hmac: hmacOf(type, syntheticIdentifier(type, i, random)),
        });
      }
    }
    for (const { type, value } of PERSONA.identifiers) {
      if (persona.includes(type)) {
        records.push({ breachId: breach.id, assetType: type, hmac: hmacOf(type, value) });
      }
    }
    await db.breachRecord.createMany({ data: records, skipDuplicates: true });
  }

  await db.pairingToken.deleteMany({ where: { userId: user.id, label: "seed" } });
  const token = generatePairingToken();
  await db.pairingToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      label: "seed",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  const check = await runBreachCheck(db);

  // Datas de detecção realistas para a demo (o job grava "agora").
  for (const spec of BREACHES) {
    await db.exposure.updateMany({
      where: { breach: { slug: spec.slug }, asset: { userId: user.id } },
      data: { detectedAt: spec.detectedAt },
    });
  }

  // Auditorias fictícias da persona. Apaga as anteriores, inclusive testes manuais do agente.
  await db.networkScan.deleteMany({ where: { userId: user.id } });
  for (const scan of DEMO_SCANS) {
    await db.networkScan.create({ data: { ...scan, user: { connect: { id: user.id } } } });
  }

  // Vazamentos reais (só metadados) do catálogo público do HIBP. Sem internet, o seed segue sem eles.
  let catalog: Awaited<ReturnType<typeof importHibpCatalog>> | null = null;
  try {
    catalog = await importHibpCatalog(db);
  } catch (error) {
    console.warn(`  Catálogo do HIBP não importado: ${(error as Error).message}`);
  }

  console.log("Seed concluído (dados sintéticos).");
  if (catalog) {
    console.log(`  Catálogo HIBP: ${catalog.created} novos, ${catalog.updated} atualizados, ${catalog.skipped} ignorados`);
  }
  console.log(`  Persona: ${PERSONA.email}`);
  console.log(`  Vazamentos sintéticos: ${BREACHES.length}`);
  console.log(`  Exposições novas da persona: ${check.newExposures.length}`);
  console.log(`  Auditorias de rede fictícias: ${DEMO_SCANS.length}`);
  console.log("  Token de pareamento do agente (válido por 30 dias, mostrado só agora):");
  console.log(`  ${token}`);
}

try {
  await main();
} finally {
  await db.$disconnect();
}
