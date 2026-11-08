/**
 * Seed data acuan Nata Baby.
 *
 * Idempoten: semua penulisan memakai upsert dengan kunci unik, jadi aman
 * dijalankan berulang. Jalankan dengan `npx prisma db seed`.
 *
 * Isi:
 *  - 3 peran (SUPER_ADMIN, ADMIN, PARENT)
 *  - 4 tipe standar pertumbuhan (WFA, HFA, WFH, HCF)
 *  - aturan status gizi per tipe
 *  - standar pertumbuhan contoh (median + titik SD) untuk 0-24 bulan
 *  - master imunisasi dasar
 *  - master milestone 0-24 bulan
 *
 * Catatan penting soal standar pertumbuhan: angka di bawah adalah nilai median
 * dan simpangan baku yang disederhanakan untuk pengembangan, BUKAN tabel resmi
 * WHO. Untuk produksi, ganti dengan tabel WHO lengkap beserta kolom L, M, S.
 * Selama kolom LMS kosong, perhitungan z memakai interpolasi antar titik SD dan
 * hasilnya pendekatan, bukan z resmi.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ROLES = [
  { code: "SUPER_ADMIN", name: "Super Admin", description: "Akses penuh termasuk pengelolaan user" },
  { code: "ADMIN", name: "Admin", description: "Mengelola data semua anak" },
  { code: "PARENT", name: "Orang Tua", description: "Hanya anak yang terhubung ke akunnya" }
];

const STANDARD_TYPES = [
  { code: "WFA", name: "Berat Badan menurut Usia" },
  { code: "HFA", name: "Tinggi Badan menurut Usia" },
  { code: "WFH", name: "Berat Badan menurut Tinggi" },
  { code: "HCF", name: "Lingkar Kepala menurut Usia" }
];

/**
 * Aturan status. Batas atas eksklusif, batas bawah inklusif.
 * Label sengaja memakai bahasa yang tidak menakut-nakuti.
 */
const STATUS_RULES = [
  { standardCode: "WFA", minZScore: null, maxZScore: -3, statusLabel: "Sangat kurang", description: "Berat jauh di bawah rentang normal" },
  { standardCode: "WFA", minZScore: -3, maxZScore: -2, statusLabel: "Kurang", description: "Berat di bawah rentang normal" },
  { standardCode: "WFA", minZScore: -2, maxZScore: 2, statusLabel: "Normal", description: "Berat dalam rentang normal" },
  { standardCode: "WFA", minZScore: 2, maxZScore: null, statusLabel: "Risiko lebih", description: "Berat di atas rentang normal" },

  { standardCode: "HFA", minZScore: null, maxZScore: -3, statusLabel: "Sangat pendek", description: "Tinggi jauh di bawah rentang normal" },
  { standardCode: "HFA", minZScore: -3, maxZScore: -2, statusLabel: "Pendek", description: "Tinggi di bawah rentang normal" },
  { standardCode: "HFA", minZScore: -2, maxZScore: 2, statusLabel: "Normal", description: "Tinggi dalam rentang normal" },
  { standardCode: "HFA", minZScore: 2, maxZScore: null, statusLabel: "Tinggi", description: "Tinggi di atas rentang normal" },

  { standardCode: "WFH", minZScore: null, maxZScore: -3, statusLabel: "Gizi buruk", description: "Berat sangat tidak sepadan dengan tinggi" },
  { standardCode: "WFH", minZScore: -3, maxZScore: -2, statusLabel: "Gizi kurang", description: "Berat kurang sepadan dengan tinggi" },
  { standardCode: "WFH", minZScore: -2, maxZScore: 1, statusLabel: "Normal", description: "Berat sepadan dengan tinggi" },
  { standardCode: "WFH", minZScore: 1, maxZScore: 2, statusLabel: "Berisiko lebih", description: "Berat cenderung lebih untuk tingginya" },
  { standardCode: "WFH", minZScore: 2, maxZScore: null, statusLabel: "Lebih", description: "Berat jauh di atas rentang untuk tingginya" },

  { standardCode: "HCF", minZScore: null, maxZScore: -2, statusLabel: "Di bawah rentang", description: "Lingkar kepala kecil untuk usianya" },
  { standardCode: "HCF", minZScore: -2, maxZScore: 2, statusLabel: "Normal", description: "Lingkar kepala dalam rentang normal" },
  { standardCode: "HCF", minZScore: 2, maxZScore: null, statusLabel: "Di atas rentang", description: "Lingkar kepala besar untuk usianya" }
];

/**
 * Standar contoh. Median dan simpangan baku per bulan, untuk dua jenis kelamin.
 * Angka ini disederhanakan dari rentang normal yang umum dipakai, cukup untuk
 * menguji alur perhitungan. Ganti dengan tabel WHO sebelum dipakai sungguhan.
 */
type Curve = { month: number; median: number; sd: number };

const WFA_MALE: Curve[] = [
  { month: 0, median: 3.3, sd: 0.45 }, { month: 1, median: 4.5, sd: 0.55 },
  { month: 2, median: 5.6, sd: 0.65 }, { month: 3, median: 6.4, sd: 0.7 },
  { month: 4, median: 7.0, sd: 0.75 }, { month: 5, median: 7.5, sd: 0.8 },
  { month: 6, median: 7.9, sd: 0.85 }, { month: 7, median: 8.3, sd: 0.9 },
  { month: 8, median: 8.6, sd: 0.9 }, { month: 9, median: 8.9, sd: 0.95 },
  { month: 10, median: 9.2, sd: 0.95 }, { month: 11, median: 9.4, sd: 1.0 },
  { month: 12, median: 9.6, sd: 1.0 }, { month: 15, median: 10.3, sd: 1.1 },
  { month: 18, median: 10.9, sd: 1.2 }, { month: 21, median: 11.5, sd: 1.25 },
  { month: 24, median: 12.2, sd: 1.3 }
];

const WFA_FEMALE: Curve[] = [
  { month: 0, median: 3.2, sd: 0.4 }, { month: 1, median: 4.2, sd: 0.5 },
  { month: 2, median: 5.1, sd: 0.6 }, { month: 3, median: 5.8, sd: 0.65 },
  { month: 4, median: 6.4, sd: 0.7 }, { month: 5, median: 6.9, sd: 0.75 },
  { month: 6, median: 7.3, sd: 0.8 }, { month: 7, median: 7.6, sd: 0.85 },
  { month: 8, median: 7.9, sd: 0.85 }, { month: 9, median: 8.2, sd: 0.9 },
  { month: 10, median: 8.5, sd: 0.9 }, { month: 11, median: 8.7, sd: 0.95 },
  { month: 12, median: 8.9, sd: 0.95 }, { month: 15, median: 9.6, sd: 1.05 },
  { month: 18, median: 10.2, sd: 1.15 }, { month: 21, median: 10.9, sd: 1.2 },
  { month: 24, median: 11.5, sd: 1.25 }
];

const HFA_MALE: Curve[] = [
  { month: 0, median: 49.9, sd: 1.9 }, { month: 1, median: 54.7, sd: 2.0 },
  { month: 2, median: 58.4, sd: 2.1 }, { month: 3, median: 61.4, sd: 2.1 },
  { month: 4, median: 63.9, sd: 2.2 }, { month: 5, median: 65.9, sd: 2.2 },
  { month: 6, median: 67.6, sd: 2.3 }, { month: 7, median: 69.2, sd: 2.3 },
  { month: 8, median: 70.6, sd: 2.4 }, { month: 9, median: 72.0, sd: 2.4 },
  { month: 10, median: 73.3, sd: 2.5 }, { month: 11, median: 74.5, sd: 2.5 },
  { month: 12, median: 75.7, sd: 2.6 }, { month: 15, median: 79.1, sd: 2.8 },
  { month: 18, median: 82.3, sd: 3.0 }, { month: 21, median: 85.1, sd: 3.1 },
  { month: 24, median: 87.8, sd: 3.3 }
];

const HFA_FEMALE: Curve[] = [
  { month: 0, median: 49.1, sd: 1.8 }, { month: 1, median: 53.7, sd: 1.9 },
  { month: 2, median: 57.1, sd: 2.0 }, { month: 3, median: 59.8, sd: 2.1 },
  { month: 4, median: 62.1, sd: 2.1 }, { month: 5, median: 64.0, sd: 2.2 },
  { month: 6, median: 65.7, sd: 2.2 }, { month: 7, median: 67.3, sd: 2.3 },
  { month: 8, median: 68.7, sd: 2.3 }, { month: 9, median: 70.1, sd: 2.4 },
  { month: 10, median: 71.5, sd: 2.4 }, { month: 11, median: 72.8, sd: 2.5 },
  { month: 12, median: 74.0, sd: 2.6 }, { month: 15, median: 77.5, sd: 2.8 },
  { month: 18, median: 80.7, sd: 3.0 }, { month: 21, median: 83.7, sd: 3.1 },
  { month: 24, median: 86.4, sd: 3.3 }
];

const HCF_MALE: Curve[] = [
  { month: 0, median: 34.5, sd: 1.2 }, { month: 3, median: 40.5, sd: 1.2 },
  { month: 6, median: 43.3, sd: 1.2 }, { month: 9, median: 45.0, sd: 1.2 },
  { month: 12, median: 46.1, sd: 1.2 }, { month: 18, median: 47.4, sd: 1.2 },
  { month: 24, median: 48.3, sd: 1.2 }
];

const HCF_FEMALE: Curve[] = [
  { month: 0, median: 33.9, sd: 1.2 }, { month: 3, median: 39.5, sd: 1.2 },
  { month: 6, median: 42.2, sd: 1.2 }, { month: 9, median: 43.8, sd: 1.2 },
  { month: 12, median: 44.9, sd: 1.2 }, { month: 18, median: 46.2, sd: 1.2 },
  { month: 24, median: 47.2, sd: 1.2 }
];

/** WFH: berat median untuk tinggi tertentu, dipakai saat tinggi anak diketahui. */
const WFH_MALE: Curve[] = [
  { month: 50, median: 3.4, sd: 0.4 }, { month: 55, median: 4.5, sd: 0.5 },
  { month: 60, median: 5.9, sd: 0.6 }, { month: 65, median: 7.4, sd: 0.7 },
  { month: 70, median: 8.4, sd: 0.8 }, { month: 75, median: 9.2, sd: 0.9 },
  { month: 80, median: 10.0, sd: 1.0 }, { month: 85, median: 10.9, sd: 1.1 },
  { month: 90, median: 11.9, sd: 1.2 }
];

const WFH_FEMALE: Curve[] = [
  { month: 50, median: 3.3, sd: 0.4 }, { month: 55, median: 4.4, sd: 0.5 },
  { month: 60, median: 5.5, sd: 0.6 }, { month: 65, median: 6.9, sd: 0.7 },
  { month: 70, median: 7.9, sd: 0.8 }, { month: 75, median: 8.7, sd: 0.9 },
  { month: 80, median: 9.5, sd: 1.0 }, { month: 85, median: 10.4, sd: 1.1 },
  { month: 90, median: 11.4, sd: 1.2 }
];

const IMMUNIZATIONS = [
  { vaccineName: "Hepatitis B (<24 Jam)", recommendedAgeMonth: 0, description: "Mencegah penularan Hepatitis B dan kerusakan hati sejak lahir" },
  { vaccineName: "BCG", recommendedAgeMonth: 1, description: "Mencegah tuberkulosis (TBC) berat dan radang selaput otak" },
  { vaccineName: "Polio Tetes 1 (bOPV 1)", recommendedAgeMonth: 1, description: "Mencegah kelumpuhan akibat infeksi virus Polio tipe 1 dan 3" },
  { vaccineName: "DPT-HB-Hib 1", recommendedAgeMonth: 2, description: "Mencegah Difteri, Pertusis (batuk rejan), Tetanus, Hepatitis B, dan Hib" },
  { vaccineName: "Polio Tetes 2 (bOPV 2)", recommendedAgeMonth: 2, description: "Dosis kedua pencegahan kelumpuhan virus Polio" },
  { vaccineName: "PCV 1", recommendedAgeMonth: 2, description: "Mencegah radang paru-paru (Pneumonia) dan radang telinga" },
  { vaccineName: "Rotavirus 1 (RV 1)", recommendedAgeMonth: 2, description: "Mencegah diare cair akut berat dan dehidrasi akibat Rotavirus" },
  { vaccineName: "DPT-HB-Hib 2", recommendedAgeMonth: 3, description: "Dosis kedua pencegahan Difteri, Pertusis, Tetanus, Hep B, Hib" },
  { vaccineName: "Polio Tetes 3 (bOPV 3)", recommendedAgeMonth: 3, description: "Dosis ketiga pencegahan virus Polio" },
  { vaccineName: "PCV 2", recommendedAgeMonth: 3, description: "Dosis kedua pencegahan Pneumonia pneumokokus" },
  { vaccineName: "Rotavirus 2 (RV 2)", recommendedAgeMonth: 3, description: "Dosis kedua pencegahan diare Rotavirus (selesai < 8 bulan)" },
  { vaccineName: "DPT-HB-Hib 3", recommendedAgeMonth: 4, description: "Dosis ketiga perlindungan Difteri, Pertusis, Tetanus, Hep B, Hib" },
  { vaccineName: "Polio Tetes 4 (bOPV 4)", recommendedAgeMonth: 4, description: "Dosis keempat pencegahan virus Polio tetes" },
  { vaccineName: "Polio Suntik 1 (IPV 1)", recommendedAgeMonth: 4, description: "Vaksin Polio suntik untuk kekebalan komprehensif Polio tipe 2" },
  { vaccineName: "Rotavirus 3 (RV 3)", recommendedAgeMonth: 4, description: "Dosis ketiga diare Rotavirus (maksimal usia 8 bulan)" },
  { vaccineName: "Campak-Rubella 1 (MR 1)", recommendedAgeMonth: 9, description: "Mencegah penyakit Campak dan kecacatan janin akibat Rubela" },
  { vaccineName: "Polio Suntik 2 (IPV 2)", recommendedAgeMonth: 9, description: "Dosis kedua Polio suntik untuk memperkuat imunitas jangka panjang" },
  { vaccineName: "Japanese Encephalitis (JE)", recommendedAgeMonth: 10, description: "Mencegah radang otak virus JE (wajib di daerah endemis)" },
  { vaccineName: "PCV 3", recommendedAgeMonth: 12, description: "Dosis penguat (booster) pencegahan radang paru-paru Pneumonia" },
  { vaccineName: "DPT-HB-Hib Lanjutan", recommendedAgeMonth: 18, description: "Booster baduta untuk kekebalan Difteri, Pertusis, dan Tetanus" },
  { vaccineName: "Campak-Rubella 2 (MR 2)", recommendedAgeMonth: 18, description: "Booster baduta untuk kekebalan Campak dan Rubela" }
];

const MILESTONES = [
  { ageMonth: 0, category: "Motorik Kasar", milestoneText: "Menggerakkan kepala ke kiri dan kanan saat tengkurap" },
  { ageMonth: 1, category: "Sosial", milestoneText: "Merespons suara dengan menoleh" },
  { ageMonth: 2, category: "Motorik Halus", milestoneText: "Membuka dan menutup tangan" },
  { ageMonth: 3, category: "Motorik Kasar", milestoneText: "Mengangkat kepala dan dada saat tengkurap" },
  { ageMonth: 4, category: "Bahasa", milestoneText: "Mengoceh dan menirukan suara" },
  { ageMonth: 5, category: "Motorik Halus", milestoneText: "Meraih benda dengan kedua tangan" },
  { ageMonth: 6, category: "Motorik Kasar", milestoneText: "Mengangkat kepala dalam posisi tengkurap" },
  { ageMonth: 6, category: "Sosial", milestoneText: "Tersenyum saat melihat wajah dikenal" },
  { ageMonth: 7, category: "Motorik Kasar", milestoneText: "Duduk tanpa bantuan beberapa detik" },
  { ageMonth: 8, category: "Motorik Halus", milestoneText: "Memindahkan benda dari satu tangan ke tangan lain" },
  { ageMonth: 9, category: "Motorik Kasar", milestoneText: "Merangkak" },
  { ageMonth: 10, category: "Bahasa", milestoneText: "Mengucapkan suku kata berulang seperti mama atau dada" },
  { ageMonth: 11, category: "Motorik Halus", milestoneText: "Menjimpit benda kecil dengan ibu jari dan telunjuk" },
  { ageMonth: 12, category: "Motorik Kasar", milestoneText: "Berdiri berpegangan" },
  { ageMonth: 12, category: "Sosial", milestoneText: "Melambaikan tangan saat diminta" },
  { ageMonth: 15, category: "Motorik Kasar", milestoneText: "Berjalan sendiri tanpa bantuan" },
  { ageMonth: 18, category: "Bahasa", milestoneText: "Mengucapkan minimal tiga kata bermakna" },
  { ageMonth: 18, category: "Motorik Halus", milestoneText: "Menyusun dua balok" },
  { ageMonth: 21, category: "Sosial", milestoneText: "Menunjuk benda yang diinginkan" },
  { ageMonth: 24, category: "Bahasa", milestoneText: "Menggabungkan dua kata" },
  { ageMonth: 24, category: "Motorik Kasar", milestoneText: "Berlari tanpa jatuh" }
];

/** Bangun tujuh titik SD dari median dan simpangan baku. */
function sdPoints(median: number, sd: number) {
  const round = (value: number) => Math.round(value * 1000) / 1000;
  return {
    sdMinus3: round(median - 3 * sd),
    sdMinus2: round(median - 2 * sd),
    sdMinus1: round(median - 1 * sd),
    median: round(median),
    sdPlus1: round(median + 1 * sd),
    sdPlus2: round(median + 2 * sd),
    sdPlus3: round(median + 3 * sd)
  };
}

async function seedRoles() {
  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { code: role.code },
      create: role,
      update: { name: role.name, description: role.description }
    });
  }
  console.log(`peran: ${ROLES.length}`);
}

async function seedStandardTypes() {
  for (const type of STANDARD_TYPES) {
    await prisma.growthStandardType.upsert({
      where: { code: type.code },
      create: type,
      update: { name: type.name }
    });
  }
  console.log(`tipe standar: ${STANDARD_TYPES.length}`);
}

async function seedStatusRules() {
  for (const rule of STATUS_RULES) {
    // Tidak ada kunci unik alami, jadi cari dulu lalu perbarui atau buat.
    const existing = await prisma.growthStatusRule.findFirst({
      where: {
        standardCode: rule.standardCode,
        minZScore: rule.minZScore,
        maxZScore: rule.maxZScore
      }
    });
    if (existing) {
      await prisma.growthStatusRule.update({
        where: { id: existing.id },
        data: { statusLabel: rule.statusLabel, description: rule.description }
      });
    } else {
      await prisma.growthStatusRule.create({ data: rule });
    }
  }
  console.log(`aturan status: ${STATUS_RULES.length}`);
}

async function seedStandards() {
  const types = await prisma.growthStandardType.findMany();
  const typeId = new Map(types.map((type) => [type.code, type.id]));

  const plan: Array<{ code: string; gender: string; by: "ageInDays" | "heightCm"; curves: Curve[] }> = [
    { code: "WFA", gender: "MALE", by: "ageInDays", curves: WFA_MALE },
    { code: "WFA", gender: "FEMALE", by: "ageInDays", curves: WFA_FEMALE },
    { code: "HFA", gender: "MALE", by: "ageInDays", curves: HFA_MALE },
    { code: "HFA", gender: "FEMALE", by: "ageInDays", curves: HFA_FEMALE },
    { code: "HCF", gender: "MALE", by: "ageInDays", curves: HCF_MALE },
    { code: "HCF", gender: "FEMALE", by: "ageInDays", curves: HCF_FEMALE },
    { code: "WFH", gender: "MALE", by: "heightCm", curves: WFH_MALE },
    { code: "WFH", gender: "FEMALE", by: "heightCm", curves: WFH_FEMALE }
  ];

  let written = 0;
  for (const entry of plan) {
    const standardTypeId = typeId.get(entry.code);
    if (!standardTypeId) continue;

    for (const curve of entry.curves) {
      const points = sdPoints(curve.median, curve.sd);
      const where = {
        standardTypeId,
        gender: entry.gender,
        ageInDays: entry.by === "ageInDays" ? Math.round(curve.month * 30.4375) : null,
        heightCm: entry.by === "heightCm" ? curve.month : null
      };

      const existing = await prisma.growthStandard.findFirst({ where });
      if (existing) {
        await prisma.growthStandard.update({ where: { id: existing.id }, data: points });
      } else {
        await prisma.growthStandard.create({ data: { ...where, ...points } });
      }
      written += 1;
    }
  }
  console.log(`standar pertumbuhan: ${written} baris`);
}

async function seedImmunizations() {
  for (const item of IMMUNIZATIONS) {
    await prisma.immunizationMaster.upsert({
      where: {
        vaccineName_recommendedAgeMonth: {
          vaccineName: item.vaccineName,
          recommendedAgeMonth: item.recommendedAgeMonth
        }
      },
      create: item,
      update: { description: item.description }
    });
  }
  console.log(`imunisasi: ${IMMUNIZATIONS.length}`);
}

async function seedMilestones() {
  for (const item of MILESTONES) {
    await prisma.milestoneMaster.upsert({
      where: {
        ageMonth_milestoneText: {
          ageMonth: item.ageMonth,
          milestoneText: item.milestoneText
        }
      },
      create: item,
      update: { category: item.category }
    });
  }
  console.log(`milestone: ${MILESTONES.length}`);
}

async function main() {
  await seedRoles();
  await seedStandardTypes();
  await seedStatusRules();
  await seedStandards();
  await seedImmunizations();
  await seedMilestones();
  console.log("seed selesai");
}

main()
  .catch((error) => {
    console.error("seed gagal:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
