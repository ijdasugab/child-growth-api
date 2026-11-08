/**
 * Perhitungan status gizi dari tabel acuan.
 *
 * Dua jalur, dipilih otomatis per baris acuan:
 *
 * 1. **LMS (eksak).** Kalau kolom `l`, `m`, `s` terisi, z dihitung dengan rumus
 *    WHO: z = ((X/M)^L - 1) / (L*S) untuk L != 0, dan ln(X/M)/S untuk L = 0.
 *    Ini yang dipakai kalau tabel acuan diisi lengkap dari data WHO.
 *
 * 2. **Interpolasi linear antar titik SD (pendekatan).** Kalau LMS kosong,
 *    z dicari dengan memetakan nilai ukur ke posisi di antara tujuh titik SD
 *    (sdMinus3 .. sdPlus3). Hasilnya bukan z resmi WHO, hanya perkiraan, dan
 *    itu sebabnya setiap hasil membawa `method` supaya pemanggil tahu.
 *
 * Nilai di luar rentang SD -3 sampai +3 dijepit ke batas terdekat, karena
 * ekstrapolasi linear di luar rentang itu cepat melenceng.
 */

import { prisma } from "./prisma.js";

export type GrowthMethod = "lms" | "interpolated" | "unavailable";

export type GrowthResult = {
  z: number | null;
  label: string | null;
  method: GrowthMethod;
};

export type GrowthStatus = {
  weightForAge: GrowthResult;
  heightForAge: GrowthResult;
  weightForHeight: GrowthResult;
  headCircumference: GrowthResult;
};

const UNAVAILABLE: GrowthResult = { z: null, label: null, method: "unavailable" };

/** Titik SD berurutan dari -3 ke +3, dipakai untuk interpolasi. */
const SD_POINTS = [
  { z: -3, key: "sdMinus3" },
  { z: -2, key: "sdMinus2" },
  { z: -1, key: "sdMinus1" },
  { z: 0, key: "median" },
  { z: 1, key: "sdPlus1" },
  { z: 2, key: "sdPlus2" },
  { z: 3, key: "sdPlus3" }
] as const;

type StandardRow = {
  sdMinus3: unknown;
  sdMinus2: unknown;
  sdMinus1: unknown;
  median: unknown;
  sdPlus1: unknown;
  sdPlus2: unknown;
  sdPlus3: unknown;
  l: unknown;
  m: unknown;
  s: unknown;
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(parsed) ? parsed : null;
}

/** z dari parameter LMS. Mengembalikan null kalau parameternya tidak lengkap. */
export function zFromLms(measure: number, l: unknown, m: unknown, s: unknown): number | null {
  const L = toNumber(l);
  const M = toNumber(m);
  const S = toNumber(s);
  if (L === null || M === null || S === null) return null;
  if (M <= 0 || S <= 0 || measure <= 0) return null;

  if (Math.abs(L) < 1e-9) {
    return Math.log(measure / M) / S;
  }
  return (Math.pow(measure / M, L) - 1) / (L * S);
}

/**
 * z dari tujuh titik SD. Interpolasi linear di antara dua titik yang mengapit
 * nilai ukur.
 *
 * Di luar rentang, nilainya diekstrapolasi memakai kemiringan segmen terluar,
 * bukan dijepit ke -3 atau +3. Penjepitan tepat di batas membuat z = -3 selalu
 * jatuh ke label "Kurang" dan label "Sangat kurang" tidak pernah tercapai,
 * padahal anak di -5 SD jelas berbeda dari anak tepat di -3 SD.
 *
 * Ekstrapolasi dibatasi pada +-6 supaya masukan yang tidak masuk akal tidak
 * menghasilkan angka liar. Di atas +-3 SD nilainya tetap pendekatan, bukan z
 * resmi WHO.
 */
const EXTRAPOLATION_CAP = 6;

export function zFromSdPoints(measure: number, row: StandardRow): number | null {
  const points: Array<{ z: number; value: number }> = [];
  for (const point of SD_POINTS) {
    const value = toNumber(row[point.key]);
    if (value !== null) points.push({ z: point.z, value });
  }
  if (points.length < 2) return null;

  // Titik harus naik seiring z. Kalau tidak, data acuannya rusak.
  for (let i = 1; i < points.length; i += 1) {
    if (points[i].value <= points[i - 1].value) return null;
  }

  const first = points[0];
  const last = points[points.length - 1];

  if (measure < first.value) {
    const next = points[1];
    const slope = (next.z - first.z) / (next.value - first.value);
    return Math.max(first.z + (measure - first.value) * slope, -EXTRAPOLATION_CAP);
  }
  if (measure > last.value) {
    const prev = points[points.length - 2];
    const slope = (last.z - prev.z) / (last.value - prev.value);
    return Math.min(last.z + (measure - last.value) * slope, EXTRAPOLATION_CAP);
  }

  for (let i = 1; i < points.length; i += 1) {
    const low = points[i - 1];
    const high = points[i];
    if (measure <= high.value) {
      const span = high.value - low.value;
      if (span <= 0) return null;
      return low.z + ((measure - low.value) / span) * (high.z - low.z);
    }
  }
  return null;
}

/** Hitung z, pilih jalur LMS kalau tersedia, kalau tidak interpolasi. */
export function computeZ(measure: number | null, row: StandardRow | null): { z: number | null; method: GrowthMethod } {
  if (measure === null || !row) return { z: null, method: "unavailable" };

  const lms = zFromLms(measure, row.l, row.m, row.s);
  if (lms !== null) return { z: round2(lms), method: "lms" };

  const interpolated = zFromSdPoints(measure, row);
  if (interpolated !== null) return { z: round2(interpolated), method: "interpolated" };

  return { z: null, method: "unavailable" };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Cari label status dari tabel aturan. Aturannya `min <= z < max`, dengan
 * batas null dianggap tak berhingga.
 */
export async function resolveStatusLabel(
  standardCode: string,
  z: number | null,
  ageMonth: number | null
): Promise<string | null> {
  if (z === null) return null;

  const rules = await prisma.growthStatusRule.findMany({
    where: {
      standardCode,
      AND: [
        { OR: [{ minZScore: null }, { minZScore: { lte: z } }] },
        { OR: [{ maxZScore: null }, { maxZScore: { gt: z } }] },
        ...(ageMonth === null
          ? []
          : [
              { OR: [{ ageMinMonth: null }, { ageMinMonth: { lte: ageMonth } }] },
              { OR: [{ ageMaxMonth: null }, { ageMaxMonth: { gte: ageMonth } }] }
            ])
      ]
    },
    orderBy: [{ minZScore: "desc" }],
    take: 1
  });

  return rules[0]?.statusLabel ?? null;
}

type StandardLookup = {
  code: string;
  /** Kolom acuan: `ageInDays` untuk WFA/HFA/HCF, `heightCm` untuk WFH. */
  by: "ageInDays" | "heightCm";
  value: number | null;
};

/**
 * Ambil baris acuan terdekat. Untuk standar berbasis usia, baris dicari pada
 * usia yang sama; kalau tidak ada, ambil yang terdekat di bawahnya.
 */
async function findStandardRow(
  code: string,
  gender: string,
  lookup: StandardLookup
): Promise<StandardRow | null> {
  if (lookup.value === null) return null;

  const type = await prisma.growthStandardType.findUnique({ where: { code } });
  if (!type) return null;

  const where = {
    standardTypeId: type.id,
    gender,
    [lookup.by]: { lte: Math.round(lookup.value) }
  };

  const row = await prisma.growthStandard.findFirst({
    where,
    orderBy: { [lookup.by]: "desc" }
  });

  return (row as unknown as StandardRow) ?? null;
}

export type GrowthInput = {
  gender: string;
  ageInDays: number | null;
  weightKg: number | null;
  heightCm: number | null;
  headCircumferenceCm: number | null;
};

/**
 * Hitung keempat status sekaligus. Setiap hasil membawa `method` supaya
 * pemanggil bisa membedakan angka eksak dari pendekatan.
 */
export async function computeGrowthStatus(input: GrowthInput): Promise<GrowthStatus> {
  const ageMonth = input.ageInDays === null ? null : Math.floor(input.ageInDays / 30.4375);

  const [wfaRow, hfaRow, wfhRow, hcfRow] = await Promise.all([
    findStandardRow("WFA", input.gender, { code: "WFA", by: "ageInDays", value: input.ageInDays }),
    findStandardRow("HFA", input.gender, { code: "HFA", by: "ageInDays", value: input.ageInDays }),
    findStandardRow("WFH", input.gender, { code: "WFH", by: "heightCm", value: input.heightCm }),
    findStandardRow("HCF", input.gender, { code: "HCF", by: "ageInDays", value: input.ageInDays })
  ]);

  const wfa = computeZ(input.weightKg, wfaRow);
  const hfa = computeZ(input.heightCm, hfaRow);
  const wfh = computeZ(input.weightKg, wfhRow);
  const hcf = computeZ(input.headCircumferenceCm, hcfRow);

  const [wfaLabel, hfaLabel, wfhLabel, hcfLabel] = await Promise.all([
    resolveStatusLabel("WFA", wfa.z, ageMonth),
    resolveStatusLabel("HFA", hfa.z, ageMonth),
    resolveStatusLabel("WFH", wfh.z, ageMonth),
    resolveStatusLabel("HCF", hcf.z, ageMonth)
  ]);

  return {
    weightForAge: { z: wfa.z, label: wfaLabel, method: wfa.method },
    heightForAge: { z: hfa.z, label: hfaLabel, method: hfa.method },
    weightForHeight: { z: wfh.z, label: wfhLabel, method: wfh.method },
    headCircumference: { z: hcf.z, label: hcfLabel, method: hcf.method }
  };
}

/**
 * Evaluasi status Lingkar Lengan Atas (LiLA) balita sesuai Buku KIA 2024 hlm 49 & 128.
 */
export function computeArmCircumferenceStatus(
  armCm: number | null,
  ageMonth: number | null
): string | null {
  if (armCm === null || armCm <= 0) return null;

  if (ageMonth !== null && ageMonth < 6) {
    if (armCm < 10.0) return "Berisiko hambatan pertumbuhan";
    if (armCm >= 11.0) return "Pertumbuhan baik";
    return "Perlu pemantauan";
  }

  if (armCm < 11.5) return "Gizi buruk";
  if (armCm < 12.5) return "Gizi kurang";
  return "Gizi baik";
}

/**
 * Evaluasi tren kenaikan berat badan (Naik vs Tidak Naik / N vs T).
 */
export function computeGrowthTrend(
  currentWeight: number | null,
  previousWeight: number | null
): "N" | "T" | null {
  if (currentWeight === null || previousWeight === null) return null;
  return currentWeight > previousWeight ? "N" : "T";
}

export { UNAVAILABLE };
