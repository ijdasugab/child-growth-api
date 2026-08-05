export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Child Growth API",
    version: "0.2.0",
    description: "Dokumentasi API MVP untuk auth, user-child relation, growth tracking, dan master data."
  },
  servers: [{ url: "http://localhost:3000", description: "Local development" }],
  security: [{ bearerAuth: [] }],
  tags: [
    { name: "System" },
    { name: "Auth" },
    { name: "Admin" },
    { name: "Children" },
    { name: "Measurements" },
    { name: "Immunizations" },
    { name: "Milestones" },
    { name: "Reminders" },
    { name: "Master Data" }
  ],
  paths: {
    "/": {
      get: { tags: ["System"], security: [], summary: "API info", responses: ok("API metadata") }
    },
    "/health": {
      get: { tags: ["System"], security: [], summary: "Health check", responses: ok("API is healthy") }
    },
    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        security: [],
        summary: "Register parent user",
        requestBody: jsonBody("Register payload", {
          fullName: "Parent User",
          email: "parent@example.com",
          password: "password123",
          phoneNumber: "08123456789"
        }),
        responses: created("Registered user with tokens")
      }
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        security: [],
        summary: "Login",
        requestBody: jsonBody("Login payload", {
          email: "parent@example.com",
          password: "password123"
        }),
        responses: ok("Authenticated user with accessToken and refreshToken")
      }
    },
    "/api/auth/refresh": {
      post: {
        tags: ["Auth"],
        security: [],
        summary: "Refresh access token",
        requestBody: jsonBody("Refresh payload", { refreshToken: "refresh-token" }),
        responses: ok("New access token")
      }
    },
    "/api/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Revoke refresh token",
        requestBody: jsonBody("Logout payload", { refreshToken: "refresh-token" }),
        responses: noContent("Logged out")
      }
    },
    "/api/auth/me": {
      get: { tags: ["Auth"], summary: "Current user profile", responses: ok("Current user") }
    },
    "/api/admin/roles": {
      get: { tags: ["Admin"], summary: "List roles", responses: okArray("Roles") }
    },
    "/api/admin/users": {
      get: { tags: ["Admin"], summary: "List users", responses: okArray("Users") },
      post: {
        tags: ["Admin"],
        summary: "Create user as admin",
        requestBody: jsonBody("Admin user payload", {
          fullName: "Admin User",
          email: "admin@example.com",
          password: "password123",
          roleCodes: ["ADMIN"]
        }),
        responses: created("Created user")
      }
    },
    "/api/admin/users/{id}": {
      put: {
        tags: ["Admin"],
        summary: "Update user and roles",
        parameters: [idParam()],
        requestBody: jsonBody("User update payload", {
          fullName: "Updated User",
          isActive: true,
          roleCodes: ["PARENT"]
        }),
        responses: ok("Updated user")
      }
    },
    "/api/admin/audit-logs": {
      get: { tags: ["Admin"], summary: "Latest audit logs", responses: okArray("Audit logs") }
    },
    "/api/children": {
      get: {
        tags: ["Children"],
        summary: "List accessible children",
        description: "Admin sees all children. Parent sees children linked through user_children.",
        responses: okArray("Children")
      },
      post: {
        tags: ["Children"],
        summary: "Create child and link owner user",
        requestBody: jsonBody("Child payload", {
          fullName: "Alya",
          gender: "FEMALE",
          birthDate: "2024-01-15",
          birthWeightKg: 3.2,
          birthLengthCm: 49,
          ownerUserId: "1",
          relation: "PARENT"
        }),
        responses: created("Created child")
      }
    },
    "/api/children/{id}": {
      get: { tags: ["Children"], summary: "Child detail", parameters: [idParam()], responses: ok("Child detail") },
      put: {
        tags: ["Children"],
        summary: "Update child",
        parameters: [idParam()],
        requestBody: jsonBody("Child update payload", { fullName: "Alya Putri" }),
        responses: ok("Updated child")
      },
      delete: { tags: ["Children"], summary: "Delete child", parameters: [idParam()], responses: noContent("Deleted child") }
    },
    "/api/children/{id}/users": {
      post: {
        tags: ["Children"],
        summary: "Link user to child",
        parameters: [idParam()],
        requestBody: jsonBody("User child payload", { userId: "2", relation: "PARENT" }),
        responses: created("Linked user-child relation")
      }
    },
    "/api/children/{childId}/measurements": {
      get: { tags: ["Measurements"], summary: "List measurements", parameters: [childIdParam()], responses: okArray("Measurements") },
      post: {
        tags: ["Measurements"],
        summary: "Create measurement",
        parameters: [childIdParam()],
        requestBody: jsonBody("Measurement payload", {
          measuredAt: "2024-03-15",
          weightKg: 5.1,
          heightCm: 57.5,
          headCircumferenceCm: 39,
          weightForAgeStatus: "Berat badan normal"
        }),
        responses: created("Created measurement")
      }
    },
    "/api/children/{childId}/measurements/history": {
      get: {
        tags: ["Measurements"],
        summary: "Measurement history with child profile fields",
        parameters: [childIdParam()],
        responses: okArray("Measurement history")
      }
    },
    "/api/children/{childId}/measurements/{id}": {
      put: {
        tags: ["Measurements"],
        summary: "Update measurement",
        parameters: [childIdParam(), idParam()],
        requestBody: jsonBody("Measurement update payload", { notes: "Kontrol ulang" }),
        responses: ok("Updated measurement")
      },
      delete: { tags: ["Measurements"], summary: "Delete measurement", parameters: [childIdParam(), idParam()], responses: noContent("Deleted measurement") }
    },
    "/api/children/{childId}/immunizations": collectionPath("Immunizations", "immunization", {
      immunizationMasterId: "1",
      givenDate: "2024-02-15",
      location: "Puskesmas",
      notes: "Selesai"
    }),
    "/api/children/{childId}/immunizations/{id}": updatePath("Immunizations", "immunization", { notes: "Updated" }),
    "/api/children/{childId}/milestones": collectionPath("Milestones", "milestone", {
      milestoneMasterId: "1",
      achieved: true,
      achievedDate: "2024-04-15",
      notes: "Sudah bisa"
    }),
    "/api/children/{childId}/milestones/{id}": updatePath("Milestones", "milestone", { achieved: true }),
    "/api/children/{childId}/reminders": collectionPath("Reminders", "reminder", {
      title: "Jadwal imunisasi",
      reminderType: "IMMUNIZATION",
      reminderDate: "2024-04-15",
      notes: "Bawa buku KIA"
    }),
    "/api/children/{childId}/reminders/{id}/done": {
      patch: {
        tags: ["Reminders"],
        summary: "Mark reminder done or undone",
        parameters: [childIdParam(), idParam()],
        requestBody: jsonBody("Done payload", { isDone: true }),
        responses: ok("Updated reminder")
      }
    },
    "/api/master-data/growth-standard-types": {
      get: { tags: ["Master Data"], summary: "List growth standard types", responses: okArray("Growth standard types") }
    },
    "/api/master-data/growth-standards": {
      get: {
        tags: ["Master Data"],
        summary: "List growth standards",
        parameters: queryParams(["standardTypeId", "gender", "ageInDays", "heightCm"]),
        responses: okArray("Growth standards")
      }
    },
    "/api/master-data/growth-status-rules": {
      get: {
        tags: ["Master Data"],
        summary: "List or match growth status rules",
        parameters: queryParams(["standardCode", "ageMonth", "zScore"]),
        responses: okArray("Growth status rules")
      }
    },
    "/api/master-data/immunizations": {
      get: { tags: ["Master Data"], summary: "List immunization master", responses: okArray("Immunization master") }
    },
    "/api/master-data/milestones": {
      get: { tags: ["Master Data"], summary: "List milestone master", responses: okArray("Milestone master") }
    }
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      }
    }
  }
} as const;

function ok(description: string) {
  return { "200": { description } };
}

function okArray(description: string) {
  return { "200": { description } };
}

function created(description: string) {
  return { "201": { description }, "400": { description: "Invalid request" }, "401": { description: "Unauthorized" } };
}

function noContent(description: string) {
  return { "204": { description }, "401": { description: "Unauthorized" }, "404": { description: "Data not found" } };
}

function jsonBody(description: string, example: Record<string, unknown>) {
  return {
    description,
    required: true,
    content: {
      "application/json": {
        schema: { type: "object" },
        example
      }
    }
  };
}

function idParam() {
  return { name: "id", in: "path", required: true, schema: { type: "string", example: "1" } };
}

function childIdParam() {
  return { name: "childId", in: "path", required: true, schema: { type: "string", example: "1" } };
}

function queryParams(names: string[]) {
  return names.map((name) => ({
    name,
    in: "query",
    required: false,
    schema: { type: "string" }
  }));
}

function collectionPath(tag: string, label: string, example: Record<string, unknown>) {
  return {
    get: {
      tags: [tag],
      summary: `List child ${label}s`,
      parameters: [childIdParam()],
      responses: okArray(`${tag} list`)
    },
    post: {
      tags: [tag],
      summary: `Create child ${label}`,
      parameters: [childIdParam()],
      requestBody: jsonBody(`${label} payload`, example),
      responses: created(`Created ${label}`)
    }
  };
}

function updatePath(tag: string, label: string, example: Record<string, unknown>) {
  return {
    put: {
      tags: [tag],
      summary: `Update child ${label}`,
      parameters: [childIdParam(), idParam()],
      requestBody: jsonBody(`${label} update payload`, example),
      responses: ok(`Updated ${label}`)
    }
  };
}
