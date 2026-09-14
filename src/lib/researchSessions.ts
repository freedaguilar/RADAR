import { PriceRecord, Product, Chain, User } from '../types';
import { parsePriceRecordMeta, ResearchSessionMeta } from './textUtils';

export interface ResearchSession {
  id: string;
  chainId: string;
  chainName: string;
  chainColor: string;
  chainLogoUrl?: string;
  state: string;
  userName: string;
  userEmail: string;
  userRole: string;
  date: string; // YYYY-MM-DD
  timeDisplay: string; // e.g. "15:42" or "15:10 - 15:42"
  startedAt?: string;
  completedAt?: string;
  
  // Records
  records: PriceRecord[];
  pendingRecords: PriceRecord[];
  consolidatedRecords: PriceRecord[];

  // Survey tracking
  outOfStockProductIds: string[];
  outOfStockProductNames: string[];
  completedEarly: boolean;
  remainingQueueCount: number;
  queueTotal: number;
  hasExplicitSession: boolean;
  isConcluded: boolean;

  // Stats
  totalItems: number;
  totalPriceSum: number;
  averagePrice: number;
  createdAtTimestamp: number;
}

/**
 * Extracts a numeric timestamp from a PriceRecord id or date.
 * Many records have IDs formatted like `rec-field-1726272890000-xyz` or `rec-pending-1726272890000-abc`.
 */
function extractTimestampFromRecord(record: PriceRecord): number {
  if (record.id) {
    const match = record.id.match(/\b(\d{12,14})\b/);
    if (match) {
      const ts = Number(match[1]);
      if (!isNaN(ts) && ts > 1600000000000 && ts < 2500000000000) {
        return ts;
      }
    }
  }

  if (record.date) {
    const parsed = new Date(record.date).getTime();
    if (!isNaN(parsed)) return parsed;
  }

  return Date.now();
}

/**
 * Formats a Date object to "HH:mm" in PT-BR.
 */
function formatTimeHHMM(date: Date): string {
  try {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
}

/**
 * Formats a YYYY-MM-DD date string to "DD/MM/YYYY".
 */
export function formatDateBR(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-');
    if (year && month && day) {
      return `${day}/${month}/${year}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

/**
 * Groups price records into coherent research sessions.
 * Supports both explicit research sessions (with sessionId in notes)
 * and intelligent clustering for legacy records based on user, chain, state, and time.
 */
export function groupRecordsIntoResearchSessions(
  records: PriceRecord[],
  chains: Chain[],
  products: Product[],
  users?: User[]
): ResearchSession[] {
  if (!records || records.length === 0) return [];

  // Map chains for fast lookup
  const chainMap = new Map<string, Chain>();
  chains.forEach((c) => chainMap.set(c.id, c));

  // Map products for fast lookup
  const productMap = new Map<string, Product>();
  products.forEach((p) => productMap.set(p.id, p));

  // Map users for fast role lookup
  const userMap = new Map<string, User>();
  if (users) {
    users.forEach((u) => {
      if (u.id) userMap.set(u.id.toLowerCase(), u);
      if (u.email) userMap.set(u.email.toLowerCase(), u);
      if (u.name) userMap.set(u.name.toLowerCase().trim(), u);
    });
  }

  // Temporary container for grouped records
  interface SessionBucket {
    key: string;
    explicitSessionId?: string;
    chainId: string;
    state: string;
    userName: string;
    userEmail: string;
    date: string;
    records: PriceRecord[];
    sessionMetas: ResearchSessionMeta[];
    timestamps: number[];
  }

  const buckets = new Map<string, SessionBucket>();

  for (const record of records) {
    const { session } = parsePriceRecordMeta(record.notes);
    const ts = extractTimestampFromRecord(record);
    const dateStr = record.date || new Date(ts).toISOString().split('T')[0];
    const chainId = record.chainId || 'unknown';
    const state = record.state || 'Minas Gerais';
    const userName = (record.userName || 'Pesquisador').trim();
    const userEmail = (record.userEmail || '').trim();

    let bucketKey = '';
    if (session?.sessionId) {
      // Direct explicit session match
      bucketKey = `session-${session.sessionId}`;
    } else {
      // Cluster by date, chain, state, user, and a 45-minute timestamp block
      const timeBlock = Math.floor(ts / (45 * 60 * 1000));
      bucketKey = `cluster-${dateStr}-${chainId}-${state}-${userName.toLowerCase()}-${timeBlock}`;
    }

    let bucket = buckets.get(bucketKey);
    if (!bucket) {
      bucket = {
        key: bucketKey,
        explicitSessionId: session?.sessionId,
        chainId,
        state,
        userName,
        userEmail,
        date: dateStr,
        records: [],
        sessionMetas: [],
        timestamps: [],
      };
      buckets.set(bucketKey, bucket);
    }

    bucket.records.push(record);
    bucket.timestamps.push(ts);
    if (session) {
      bucket.sessionMetas.push(session);
    }
  }

  // Convert buckets into structured ResearchSession objects
  const sessions: ResearchSession[] = [];

  buckets.forEach((bucket) => {
    const chain = chainMap.get(bucket.chainId);
    const chainName = chain?.name || 'Rede Não Identificada';
    const chainColor = chain?.logoColor || '#64748B';
    const chainLogoUrl = chain?.logoUrl;

    // Determine user role
    let userRole = 'Promotor';
    const emailKey = bucket.userEmail.toLowerCase();
    const nameKey = bucket.userName.toLowerCase();
    const matchedUser = userMap.get(emailKey) || userMap.get(nameKey);
    if (matchedUser) {
      if (matchedUser.role === 'gestor') userRole = 'Gestor';
      else if (matchedUser.role === 'promotor') userRole = 'Promotor';
      else if (matchedUser.role === 'vendedor') userRole = 'Vendedor';
      else if (matchedUser.isGuest) userRole = 'Convidado';
    } else if (bucket.userName.toLowerCase().includes('convidado') || bucket.records.some(r => r.notes?.includes('[Registro Convidado'))) {
      userRole = 'Convidado';
    }

    // Merge session metadata if present
    let startedAt: string | undefined;
    let completedAt: string | undefined;
    let explicitSessionTime: string | undefined;
    const outOfStockIdsSet = new Set<string>();
    const outOfStockNamesSet = new Set<string>();
    let completedEarly = false;
    let remainingQueueCount = 0;
    let queueTotal = 0;
    let hasExplicitSession = Boolean(bucket.explicitSessionId);
    let hasExplicitConcludedMeta = false;
    let isConcluded = false;

    for (const meta of bucket.sessionMetas) {
      if (meta.startedAt && !startedAt) startedAt = meta.startedAt;
      if (meta.completedAt) completedAt = meta.completedAt;
      if (meta.sessionTime && !explicitSessionTime) explicitSessionTime = meta.sessionTime;
      if (meta.completedEarly) completedEarly = true;
      if (typeof meta.remainingQueueCount === 'number' && meta.remainingQueueCount > remainingQueueCount) {
        remainingQueueCount = meta.remainingQueueCount;
      }
      if (typeof meta.queueTotal === 'number' && meta.queueTotal > queueTotal) {
        queueTotal = meta.queueTotal;
      }
      if (meta.outOfStockProductIds) {
        meta.outOfStockProductIds.forEach((id) => outOfStockIdsSet.add(id));
      }
      if (meta.outOfStockProductNames) {
        meta.outOfStockProductNames.forEach((n) => outOfStockNamesSet.add(n));
      }
      if (typeof meta.isConcluded === 'boolean') {
        hasExplicitConcludedMeta = true;
        if (meta.isConcluded) {
          isConcluded = true;
        }
      }
    }

    // Populate missing out of stock product names from productMap
    outOfStockIdsSet.forEach((id) => {
      const prod = productMap.get(id);
      if (prod && prod.name) {
        outOfStockNamesSet.add(prod.name);
      }
    });

    // Timestamps calculation
    bucket.timestamps.sort((a, b) => a - b);
    const earliestTs = bucket.timestamps[0] || Date.now();
    const latestTs = bucket.timestamps[bucket.timestamps.length - 1] || earliestTs;

    // If no record has explicit isConcluded flag, deduce for legacy records
    if (!hasExplicitConcludedMeta) {
      const ageMs = Date.now() - latestTs;
      // Only mark legacy sessions as concluded if explicitly marked completedEarly or completedAt,
      // or if inactive for more than 4 hours. Do NOT conclude just because some record was consolidated.
      if (completedAt || completedEarly || ageMs > 4 * 60 * 60 * 1000) {
        isConcluded = true;
      } else {
        isConcluded = false;
      }
    }

    // Time display calculation
    let timeDisplay = '';
    if (explicitSessionTime) {
      timeDisplay = explicitSessionTime;
    } else if (startedAt && completedAt) {
      const sDate = new Date(startedAt);
      const cDate = new Date(completedAt);
      if (!isNaN(sDate.getTime()) && !isNaN(cDate.getTime())) {
        timeDisplay = `${formatTimeHHMM(sDate)} - ${formatTimeHHMM(cDate)}`;
      }
    }

    if (!timeDisplay) {
      if (bucket.timestamps.length > 1 && latestTs - earliestTs > 60000) {
        timeDisplay = `${formatTimeHHMM(new Date(earliestTs))} - ${formatTimeHHMM(new Date(latestTs))}`;
      } else {
        timeDisplay = formatTimeHHMM(new Date(latestTs));
      }
    }

    // Separate pending vs. consolidated records
    const pendingRecords: PriceRecord[] = [];
    const consolidatedRecords: PriceRecord[] = [];
    let totalPriceSum = 0;

    bucket.records.forEach((rec) => {
      const { isPending } = parsePriceRecordMeta(rec.notes);
      if (!rec.productId || isPending) {
        pendingRecords.push(rec);
      } else {
        consolidatedRecords.push(rec);
        totalPriceSum += rec.price || 0;
      }
    });

    // Sort records within session (newest first)
    pendingRecords.sort((a, b) => extractTimestampFromRecord(b) - extractTimestampFromRecord(a));
    consolidatedRecords.sort((a, b) => extractTimestampFromRecord(b) - extractTimestampFromRecord(a));

    const totalItems = bucket.records.length;
    const averagePrice = consolidatedRecords.length > 0 ? totalPriceSum / consolidatedRecords.length : 0;

    sessions.push({
      id: bucket.explicitSessionId || bucket.key,
      chainId: bucket.chainId,
      chainName,
      chainColor,
      chainLogoUrl,
      state: bucket.state,
      userName: bucket.userName,
      userEmail: bucket.userEmail,
      userRole,
      date: bucket.date,
      timeDisplay,
      startedAt,
      completedAt,
      records: bucket.records,
      pendingRecords,
      consolidatedRecords,
      outOfStockProductIds: Array.from(outOfStockIdsSet),
      outOfStockProductNames: Array.from(outOfStockNamesSet),
      completedEarly,
      remainingQueueCount,
      queueTotal,
      hasExplicitSession,
      isConcluded,
      totalItems,
      totalPriceSum,
      averagePrice,
      createdAtTimestamp: latestTs,
    });
  });

  // Sort sessions: newest session first
  sessions.sort((a, b) => {
    // 1. By date string comparison
    const dateComp = (b.date || '').localeCompare(a.date || '');
    if (dateComp !== 0) return dateComp;
    // 2. By timestamp
    return b.createdAtTimestamp - a.createdAtTimestamp;
  });

  return sessions;
}
