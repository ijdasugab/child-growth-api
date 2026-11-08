/**
 * Buat akun admin pertama, atau tambah peran admin ke akun yang sudah ada.
 *
 * Registrasi publik hanya menghasilkan peran PARENT, jadi butuh jalur ini
 * supaya ada akun pertama yang bisa mengelola. Tidak ada password di dalam
 * repo: password diminta lewat argumen atau variabel lingkungan.
 *
 * Pemakaian:
 *
 *   node --import tsx scripts/create-admin.ts --email a@b.c --password "rahasia" --name "Nama"
 *
 * atau:
 *
 *   ADMIN_EMAIL=a@b.c ADMIN_PASSWORD="rahasia" ADMIN_NAME="Nama" npx tsx scripts/create-admin.ts
 */

import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function readArg(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : null;
}

async function main() {
  const email = (readArg("--email") ?? process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = readArg("--password") ?? process.env.ADMIN_PASSWORD ?? "";
  const fullName = readArg("--name") ?? process.env.ADMIN_NAME ?? "Admin";
  const roleCode = (readArg("--role") ?? "SUPER_ADMIN").toUpperCase();

  if (!email || !password) {
    console.error("Butuh --email dan --password (atau ADMIN_EMAIL dan ADMIN_PASSWORD).");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password minimal 8 karakter.");
    process.exit(1);
  }
  if (!["SUPER_ADMIN", "ADMIN"].includes(roleCode)) {
    console.error("Peran harus SUPER_ADMIN atau ADMIN.");
    process.exit(1);
  }

  const role = await prisma.role.findUnique({ where: { code: roleCode } });
  if (!role) {
    console.error(`Peran ${roleCode} tidak ada. Jalankan dulu: npx prisma db seed`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    create: { fullName, email, passwordHash },
    update: { passwordHash, isActive: true }
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    create: { userId: user.id, roleId: role.id },
    update: {}
  });

  console.log(`Akun siap: ${user.email} (id ${user.id}) dengan peran ${roleCode}.`);
}

main()
  .catch((error) => {
    console.error("gagal:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
