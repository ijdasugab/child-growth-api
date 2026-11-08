-- CreateTable
CREATE TABLE "users" (
    "id" BIGSERIAL NOT NULL,
    "full_name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "phone_number" VARCHAR(30),
    "is_active" BOOLEAN DEFAULT true,
    "last_login_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" BIGSERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "role_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_children" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "child_id" BIGINT NOT NULL,
    "relation" VARCHAR(50),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_children_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_refresh_tokens" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "expired_at" TIMESTAMP(6) NOT NULL,
    "revoked_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT,
    "action" VARCHAR(50) NOT NULL,
    "table_name" VARCHAR(100),
    "record_id" BIGINT,
    "old_data" JSONB,
    "new_data" JSONB,
    "ip_address" VARCHAR(100),
    "user_agent" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "children" (
    "id" BIGSERIAL NOT NULL,
    "full_name" VARCHAR(100) NOT NULL,
    "gender" VARCHAR(10) NOT NULL,
    "birth_date" DATE NOT NULL,
    "birth_weight_kg" DECIMAL(5,2),
    "birth_length_cm" DECIMAL(5,2),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "created_by" BIGINT,
    "updated_by" BIGINT,

    CONSTRAINT "children_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "child_measurements" (
    "id" BIGSERIAL NOT NULL,
    "child_id" BIGINT NOT NULL,
    "measured_at" DATE NOT NULL,
    "weight_kg" DECIMAL(5,2),
    "height_cm" DECIMAL(5,2),
    "head_circumference_cm" DECIMAL(5,2),
    "notes" TEXT,
    "age_in_days" INTEGER,
    "weight_for_age_z" DECIMAL(4,2),
    "height_for_age_z" DECIMAL(4,2),
    "weight_for_height_z" DECIMAL(4,2),
    "head_circumference_z" DECIMAL(4,2),
    "weight_for_age_status" VARCHAR(50),
    "height_for_age_status" VARCHAR(50),
    "weight_for_height_status" VARCHAR(50),
    "head_circumference_status" VARCHAR(50),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "created_by" BIGINT,
    "updated_by" BIGINT,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "child_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "child_immunizations" (
    "id" BIGSERIAL NOT NULL,
    "child_id" BIGINT NOT NULL,
    "immunization_master_id" BIGINT,
    "given_date" DATE,
    "location" VARCHAR(150),
    "notes" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "created_by" BIGINT,
    "updated_by" BIGINT,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "child_immunizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "child_milestones" (
    "id" BIGSERIAL NOT NULL,
    "child_id" BIGINT NOT NULL,
    "milestone_master_id" BIGINT NOT NULL,
    "achieved" BOOLEAN DEFAULT false,
    "achieved_date" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "created_by" BIGINT,
    "updated_by" BIGINT,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "child_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_standard_types" (
    "id" BIGSERIAL NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "growth_standard_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_standards" (
    "id" BIGSERIAL NOT NULL,
    "standard_type_id" BIGINT NOT NULL,
    "gender" VARCHAR(10) NOT NULL,
    "age_in_days" INTEGER,
    "height_cm" DECIMAL(5,2),
    "sd_minus_3" DECIMAL(7,3),
    "sd_minus_2" DECIMAL(7,3),
    "sd_minus_1" DECIMAL(7,3),
    "median" DECIMAL(7,3),
    "sd_plus_1" DECIMAL(7,3),
    "sd_plus_2" DECIMAL(7,3),
    "sd_plus_3" DECIMAL(7,3),
    "l" DECIMAL(10,6),
    "m" DECIMAL(10,6),
    "s" DECIMAL(10,6),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "growth_standards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_status_rules" (
    "id" BIGSERIAL NOT NULL,
    "standard_code" VARCHAR(30) NOT NULL,
    "min_z_score" DECIMAL(4,2),
    "max_z_score" DECIMAL(4,2),
    "status_label" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "age_min_month" INTEGER DEFAULT 0,
    "age_max_month" INTEGER DEFAULT 60,

    CONSTRAINT "growth_status_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "immunization_master" (
    "id" BIGSERIAL NOT NULL,
    "vaccine_name" VARCHAR(100) NOT NULL,
    "recommended_age_month" INTEGER,
    "description" TEXT,

    CONSTRAINT "immunization_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestone_master" (
    "id" BIGSERIAL NOT NULL,
    "age_month" INTEGER NOT NULL,
    "category" VARCHAR(50),
    "milestone_text" TEXT NOT NULL,

    CONSTRAINT "milestone_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" BIGSERIAL NOT NULL,
    "child_id" BIGINT NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "reminder_type" VARCHAR(50),
    "reminder_date" DATE NOT NULL,
    "is_done" BOOLEAN DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "created_by" BIGINT,
    "updated_by" BIGINT,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_email" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE INDEX "idx_user_roles_user_id" ON "user_roles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_user_role" ON "user_roles"("user_id", "role_id");

-- CreateIndex
CREATE INDEX "idx_user_children_child_id" ON "user_children"("child_id");

-- CreateIndex
CREATE INDEX "idx_user_children_user_id" ON "user_children"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_user_child" ON "user_children"("user_id", "child_id");

-- CreateIndex
CREATE INDEX "idx_refresh_tokens_token" ON "user_refresh_tokens"("refresh_token");

-- CreateIndex
CREATE INDEX "idx_refresh_tokens_user_active" ON "user_refresh_tokens"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "idx_audit_logs_table_record" ON "audit_logs"("table_name", "record_id");

-- CreateIndex
CREATE INDEX "idx_audit_logs_user_id" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "idx_child_measurements_child_id" ON "child_measurements"("child_id");

-- CreateIndex
CREATE INDEX "idx_child_measurements_measured_at" ON "child_measurements"("measured_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_child_measurement_date" ON "child_measurements"("child_id", "measured_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_child_milestone" ON "child_milestones"("child_id", "milestone_master_id");

-- CreateIndex
CREATE UNIQUE INDEX "growth_standard_types_code_key" ON "growth_standard_types"("code");

-- CreateIndex
CREATE INDEX "idx_growth_standards_type_gender_age" ON "growth_standards"("standard_type_id", "gender", "age_in_days");

-- CreateIndex
CREATE INDEX "idx_growth_standards_type_gender_height" ON "growth_standards"("standard_type_id", "gender", "height_cm");

-- CreateIndex
CREATE INDEX "idx_status_rules_lookup" ON "growth_status_rules"("standard_code", "min_z_score", "max_z_score");

-- CreateIndex
CREATE UNIQUE INDEX "uq_immunization_name_age" ON "immunization_master"("vaccine_name", "recommended_age_month");

-- CreateIndex
CREATE UNIQUE INDEX "uq_milestone_age_text" ON "milestone_master"("age_month", "milestone_text");

-- CreateIndex
CREATE INDEX "idx_reminders_child_date" ON "reminders"("child_id", "reminder_date");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_children" ADD CONSTRAINT "user_children_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_children" ADD CONSTRAINT "user_children_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_refresh_tokens" ADD CONSTRAINT "user_refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_measurements" ADD CONSTRAINT "child_measurements_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_immunizations" ADD CONSTRAINT "child_immunizations_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_immunizations" ADD CONSTRAINT "child_immunizations_immunization_master_id_fkey" FOREIGN KEY ("immunization_master_id") REFERENCES "immunization_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_milestones" ADD CONSTRAINT "child_milestones_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_milestones" ADD CONSTRAINT "child_milestones_milestone_master_id_fkey" FOREIGN KEY ("milestone_master_id") REFERENCES "milestone_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_standards" ADD CONSTRAINT "growth_standards_standard_type_id_fkey" FOREIGN KEY ("standard_type_id") REFERENCES "growth_standard_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_status_rules" ADD CONSTRAINT "growth_status_rules_standard_code_fkey" FOREIGN KEY ("standard_code") REFERENCES "growth_standard_types"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

