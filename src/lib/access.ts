import { isAdminRole } from "./auth.js";
import { prisma } from "./prisma.js";

export async function canAccessChild(user: { id: bigint; roles: string[] }, childId: bigint) {
  if (isAdminRole(user.roles) || user.roles.includes("GUEST")) {
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
