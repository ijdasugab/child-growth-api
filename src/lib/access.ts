import { isAdminRole } from "./auth.js";
import { prisma } from "./prisma.js";

export async function canAccessChild(user: { id: bigint; roles: string[] }, childId: bigint) {
  // P0-1: peran GUEST sudah tidak ada. Admin tetap melihat semua anak.
  if (isAdminRole(user.roles)) {
    return true;
  }

  const relation = await prisma.userChild.findUnique({
    where: {
      userId_childId: {
        userId: user.id,
        childId
      }
    }
  });

  return Boolean(relation);
}

export async function ensureChildAccess(user: { id: bigint; roles: string[] }, childId: bigint) {
  const allowed = await canAccessChild(user, childId);

  if (!allowed) {
    const error = new Error("Child access denied");
    error.name = "ForbiddenError";
    throw error;
  }
}
