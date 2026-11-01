-- CreateEnum
CREATE TYPE "Role" AS ENUM ('citizen', 'municipal_admin', 'system_admin');

-- CreateEnum
CREATE TYPE "WasteType" AS ENUM ('organic', 'plastic', 'construction', 'biomedical', 'mixed');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('Low', 'Med', 'High');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('Pending', 'In Progress', 'Resolved');

-- CreateEnum
CREATE TYPE "HazardLevel" AS ENUM ('Low', 'Medium', 'High');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('Active', 'Acknowledged', 'Resolved');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'citizen',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zones" (
    "id" SERIAL NOT NULL,
    "city_id" INTEGER NOT NULL DEFAULT 1,
    "name" VARCHAR(120) NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "zone_type" VARCHAR(80) NOT NULL,
    "current_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "current_level" "HazardLevel" NOT NULL DEFAULT 'Low',
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waste_reports" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "zone_id" INTEGER NOT NULL,
    "waste_type" "WasteType" NOT NULL,
    "severity" "Severity" NOT NULL,
    "image_url" VARCHAR(512),
    "description" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'Pending',
    "reported_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waste_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hazard_scores" (
    "id" SERIAL NOT NULL,
    "zone_id" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "level" "HazardLevel" NOT NULL,
    "inputs_json" JSONB NOT NULL,
    "computed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hazard_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" SERIAL NOT NULL,
    "zone_id" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL DEFAULT 7.0,
    "status" "AlertStatus" NOT NULL DEFAULT 'Active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "remediation_rules" (
    "id" SERIAL NOT NULL,
    "waste_type" "WasteType" NOT NULL,
    "level" "HazardLevel" NOT NULL,
    "action" TEXT NOT NULL,

    CONSTRAINT "remediation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "zones_name_key" ON "zones"("name");

-- CreateIndex
CREATE INDEX "zones_current_level_idx" ON "zones"("current_level");

-- CreateIndex
CREATE INDEX "waste_reports_zone_id_status_reported_at_idx" ON "waste_reports"("zone_id", "status", "reported_at");

-- CreateIndex
CREATE INDEX "waste_reports_user_id_idx" ON "waste_reports"("user_id");

-- CreateIndex
CREATE INDEX "waste_reports_zone_id_reported_at_idx" ON "waste_reports"("zone_id", "reported_at");

-- CreateIndex
CREATE INDEX "hazard_scores_zone_id_computed_at_idx" ON "hazard_scores"("zone_id", "computed_at" DESC);

-- CreateIndex
CREATE INDEX "alerts_zone_id_status_idx" ON "alerts"("zone_id", "status");

-- CreateIndex
CREATE INDEX "alerts_status_created_at_idx" ON "alerts"("status", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "remediation_rules_waste_type_level_key" ON "remediation_rules"("waste_type", "level");

-- AddForeignKey
ALTER TABLE "waste_reports" ADD CONSTRAINT "waste_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waste_reports" ADD CONSTRAINT "waste_reports_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hazard_scores" ADD CONSTRAINT "hazard_scores_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
