import type { Db } from "../../shared/db.js";

export interface BreachCheckResult {
  assetsChecked: number;
  matches: number;
  newExposures: Array<{ id: string; assetId: string; breachId: string }>;
}

const CHUNK_SIZE = 500;

/**
 * Cruza os ativos verificados com a base de vazamentos (por HMAC) e registra só as exposições novas.
 * A deduplicação vem do unique (assetId, breachId): rodar o job de novo não gera alerta repetido.
 */
export async function runBreachCheck(db: Db): Promise<BreachCheckResult> {
  const assets = await db.asset.findMany({
    where: { verifiedAt: { not: null } },
    select: { id: true, type: true, hmac: true },
  });

  const assetIdByKey = new Map(assets.map((asset) => [`${asset.type}:${asset.hmac}`, asset.id]));
  const candidates: Array<{ assetId: string; breachId: string }> = [];

  for (let i = 0; i < assets.length; i += CHUNK_SIZE) {
    const chunk = assets.slice(i, i + CHUNK_SIZE);
    const records = await db.breachRecord.findMany({
      where: { OR: chunk.map((asset) => ({ assetType: asset.type, hmac: asset.hmac })) },
      select: { breachId: true, assetType: true, hmac: true },
    });
    for (const record of records) {
      const assetId = assetIdByKey.get(`${record.assetType}:${record.hmac}`);
      if (assetId) candidates.push({ assetId, breachId: record.breachId });
    }
  }

  const newExposures =
    candidates.length === 0
      ? []
      : await db.exposure.createManyAndReturn({
          data: candidates,
          skipDuplicates: true,
          select: { id: true, assetId: true, breachId: true },
        });

  return { assetsChecked: assets.length, matches: candidates.length, newExposures };
}
