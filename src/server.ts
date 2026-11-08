import "dotenv/config";
import { app } from "./app.js";

const port = Number(process.env.PORT ?? 3000);

// P0-4: gagal start kalau JWT_SECRET tidak layak. Nilai contoh dan kunci pendek
// ditolak, supaya tidak ada deploy yang diam-diam memakai kunci publik.
const secret = process.env.JWT_SECRET ?? "";
if (!secret || secret === "dev-only-change-me" || secret === "change-this-secret" || secret.length < 32) {
  console.error(
    "JWT_SECRET wajib diisi, minimal 32 karakter, dan tidak boleh nilai contoh.\n" +
      "Buat dengan: openssl rand -hex 32"
  );
  process.exit(1);
}

app.listen(port, () => {
  console.log(`Child growth API is running on http://localhost:${port}`);
});
