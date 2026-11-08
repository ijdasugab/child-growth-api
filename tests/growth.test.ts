/**
 * Uji perhitungan status gizi.
 *
 * Fokus pada dua jalur: LMS eksak dan interpolasi antar titik SD. Ditambah
 * pemetaan z ke label status, karena batasnya inklusif di bawah dan eksklusif
 * di atas, dan itu mudah salah.
 */

import { describe, expect, it } from "vitest";
import {
  computeArmCircumferenceStatus,
  computeGrowthTrend,
  computeZ,
  zFromLms,
  zFromSdPoints
} from "../src/lib/growth.js";

/** Baris acuan contoh: median 8, simpangan baku 1. */
const SD_ROW = {
  sdMinus3: 5,
  sdMinus2: 6,
  sdMinus1: 7,
  median: 8,
  sdPlus1: 9,
  sdPlus2: 10,
  sdPlus3: 11,
  l: null,
  m: null,
  s: null
};

const LMS_ROW = {
  ...SD_ROW,
  // Nilai LMS sederhana supaya hasilnya mudah diperiksa: L=1, M=8, S=0.1
  l: 1,
  m: 8,
  s: 0.1
};

describe("zFromLms", () => {
  it("menghasilkan 0 saat ukuran sama dengan median", () => {
    expect(zFromLms(8, 1, 8, 0.1)).toBeCloseTo(0, 10);
  });

  it("menghasilkan +1 saat ukuran di atas median sesuai S", () => {
    // L=1 -> z = (X/M - 1) / S = (8.8/8 - 1) / 0.1 = 1
    expect(zFromLms(8.8, 1, 8, 0.1)).toBeCloseTo(1, 10);
  });

  it("memakai rumus logaritma saat L mendekati nol", () => {
    // L=0 -> z = ln(X/M) / S
    expect(zFromLms(8.8, 0, 8, 0.1)).toBeCloseTo(Math.log(1.1) / 0.1, 10);
  });

  it("mengembalikan null saat parameter tidak lengkap atau tidak wajar", () => {
    expect(zFromLms(8, null, 8, 0.1)).toBeNull();
    expect(zFromLms(8, 1, null, 0.1)).toBeNull();
    expect(zFromLms(8, 1, 8, null)).toBeNull();
    expect(zFromLms(8, 1, 0, 0.1)).toBeNull();
    expect(zFromLms(0, 1, 8, 0.1)).toBeNull();
  });
});

describe("zFromSdPoints", () => {
  it("menghasilkan 0 tepat di median", () => {
    expect(zFromSdPoints(8, SD_ROW)).toBeCloseTo(0, 10);
  });

  it("menginterpolasi di antara dua titik SD", () => {
    // 7,5 berada di tengah antara sdMinus1 (7) dan median (8)
    expect(zFromSdPoints(7.5, SD_ROW)).toBeCloseTo(-0.5, 10);
    expect(zFromSdPoints(9.5, SD_ROW)).toBeCloseTo(1.5, 10);
  });

  it("mengekstrapolasi di luar rentang, bukan menjepit ke batas", () => {
    // 2 jauh di bawah sdMinus3 (5). Kemiringan segmen terluar: 1 SD per 1 unit.
    expect(zFromSdPoints(2, SD_ROW)).toBeCloseTo(-6, 10);
    // Batas aman supaya masukan liar tidak menghasilkan angka tak masuk akal.
    expect(zFromSdPoints(-100, SD_ROW)).toBe(-6);
    expect(zFromSdPoints(100, SD_ROW)).toBe(6);
  });

  it("nilai tepat di titik SD tetap eksak", () => {
    expect(zFromSdPoints(6, SD_ROW)).toBe(-2);
    expect(zFromSdPoints(7, SD_ROW)).toBe(-1);
    expect(zFromSdPoints(11, SD_ROW)).toBe(3);
  });

  it("menolak data acuan yang tidak naik", () => {
    // sdPlus2 lebih kecil dari sdPlus1: urutan titik rusak.
    const rusak = { ...SD_ROW, sdPlus2: 8.5 };
    expect(zFromSdPoints(9.8, rusak)).toBeNull();
  });

  it("mengembalikan null kalau titik kurang dari dua", () => {
    const kosong = { ...SD_ROW, sdMinus3: null, sdMinus2: null, sdMinus1: null, median: null, sdPlus1: null, sdPlus2: null };
    expect(zFromSdPoints(8, kosong)).toBeNull();
  });
});

describe("computeZ", () => {
  it("memilih jalur LMS saat tersedia", () => {
    const result = computeZ(8.8, LMS_ROW);
    expect(result.method).toBe("lms");
    expect(result.z).toBeCloseTo(1, 2);
  });

  it("jatuh ke interpolasi saat LMS kosong", () => {
    const result = computeZ(8, SD_ROW);
    expect(result.method).toBe("interpolated");
    expect(result.z).toBe(0);
  });

  it("menandai tidak tersedia saat ukuran atau acuan hilang", () => {
    expect(computeZ(null, SD_ROW)).toEqual({ z: null, method: "unavailable" });
    expect(computeZ(8, null)).toEqual({ z: null, method: "unavailable" });
  });

  it("membulatkan hasil ke dua desimal", () => {
    // 8.37 mendekati 0.37 SD pada data interpolasi
    const result = computeZ(8.37, SD_ROW);
    expect(result.z).toBe(0.37);
  });
});

describe("computeArmCircumferenceStatus", () => {
  it("mengevaluasi LiLA untuk bayi usia < 6 bulan", () => {
    expect(computeArmCircumferenceStatus(9.5, 3)).toBe("Berisiko hambatan pertumbuhan");
    expect(computeArmCircumferenceStatus(10.5, 4)).toBe("Perlu pemantauan");
    expect(computeArmCircumferenceStatus(11.2, 5)).toBe("Pertumbuhan baik");
  });

  it("mengevaluasi LiLA untuk anak usia >= 6 bulan (skrining gizi posyandu)", () => {
    expect(computeArmCircumferenceStatus(11.0, 12)).toBe("Gizi buruk");
    expect(computeArmCircumferenceStatus(12.0, 18)).toBe("Gizi kurang");
    expect(computeArmCircumferenceStatus(13.5, 24)).toBe("Gizi baik");
  });

  it("mengembalikan null untuk masukan kosong atau tidak valid", () => {
    expect(computeArmCircumferenceStatus(null, 12)).toBeNull();
    expect(computeArmCircumferenceStatus(0, 12)).toBeNull();
    expect(computeArmCircumferenceStatus(-1, 12)).toBeNull();
  });
});

describe("computeGrowthTrend", () => {
  it("menghasilkan N (naik) saat berat naik", () => {
    expect(computeGrowthTrend(8.5, 8.0)).toBe("N");
  });

  it("menghasilkan T (tidak naik) saat berat tetap atau turun", () => {
    expect(computeGrowthTrend(8.0, 8.0)).toBe("T");
    expect(computeGrowthTrend(7.8, 8.0)).toBe("T");
  });

  it("mengembalikan null kalau salah satu berat tidak ada", () => {
    expect(computeGrowthTrend(8.0, null)).toBeNull();
    expect(computeGrowthTrend(null, 8.0)).toBeNull();
  });
});
