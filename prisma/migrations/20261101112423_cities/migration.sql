-- CreateTable
CREATE TABLE "cities" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "state" VARCHAR(120),
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cities_name_key" ON "cities"("name");

-- Seed default cities before FK is enforced
INSERT INTO "cities" ("id","name","state","lat","lng") VALUES (1,'Vadodara','Gujarat',22.30,73.18),(2,'Surat','Gujarat',21.19,72.83) ON CONFLICT ("id") DO NOTHING;
SELECT setval('"cities_id_seq"', (SELECT MAX("id") FROM "cities"));

-- AddForeignKey
ALTER TABLE "zones" ADD CONSTRAINT "zones_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
