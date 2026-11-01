# Database Design — Hazard Rage

PostgreSQL 16 + PostGIS + Prisma (ADR-007, supersedes MySQL). Redis is cache only, never truth (ADR-008).

## ER (textual)

```
users 1──N waste_reports N──1 zones 1──N hazard_scores
zones 1──N alerts
remediation_rules (lookup: waste_type × level → action)
city_id=1 constant, zones.city_id ready for multi-city
PostGIS: zones.boundary GEOGRAPHY(Polygon) + zones.center GEOGRAPHY(Point)
```

## Entities (Prisma contracts — Agent 2 implements)

```prisma
enum Role { citizen municipal_admin system_admin }
enum WasteType { organic plastic construction biomedical mixed }
enum Severity { Low Med High }
enum ReportStatus { Pending In_Progress Resolved } // map "In Progress" via @map
enum HazardLevel { Low Medium High }

model User {
  id            Int           @id @default(autoincrement())
  name          String
  email         String        @unique
  passwordHash  String        @map("password_hash")
  role          Role          @default(citizen)
  createdAt     DateTime      @default(now()) @map("created_at")
  reports       WasteReport[]
}

model Zone {
  id           Int           @id @default(autoincrement())
  cityId       Int           @default(1) @map("city_id")
  name         String        @unique
  lat          Float
  lng          Float
  // PostGIS managed in migration 001: boundary GEOGRAPHY, center GEOGRAPHY(Point,4326)
  zoneType     String        @map("zone_type")
  currentScore Float         @default(0) @map("current_score")
  currentLevel HazardLevel   @default(Low) @map("current_level")
  updatedAt    DateTime      @updatedAt @map("updated_at")
  reports      WasteReport[]
  scores       HazardScore[]
  alerts       Alert[]
}

model WasteReport {
  id          Int          @id @default(autoincrement())
  userId      Int          @map("user_id")
  zoneId      Int          @map("zone_id")
  wasteType   WasteType    @map("waste_type")
  severity    Severity
  imageUrl    String?      @map("image_url")
  description String?
  status      ReportStatus @default(Pending)
  reportedAt  DateTime     @default(now()) @map("reported_at")
  user        User         @relation(fields: [userId], references: [id], onDelete: Restrict)
  zone        Zone         @relation(fields: [zoneId], references: [id], onDelete: Restrict)

  @@index([zoneId, status, reportedAt])
  @@index([userId])
  @@fulltext([description])
}

model HazardScore {
  id         Int         @id @default(autoincrement())
  zoneId     Int         @map("zone_id")
  score      Float       // CHECK 0-10
  level      HazardLevel
  inputsJson Json        @map("inputs_json") // JSONB: {volumeIndex,typeSeverity,spreadRadius,frequency,unresolvedDuration,weights}
  computedAt DateTime    @default(now()) @map("computed_at")
  zone       Zone        @relation(fields: [zoneId], references: [id], onDelete: Cascade)

  @@index([zoneId, computedAt(sort: Desc)])
}

model Alert {
  id        Int          @id @default(autoincrement())
  zoneId    Int          @map("zone_id")
  score     Float
  threshold Float        @default(7.0)
  status    AlertStatus  @default(Active)
  createdAt DateTime     @default(now()) @map("created_at")
  zone      Zone         @relation(fields: [zoneId], references: [id], onDelete: Restrict)

  @@index([zoneId, status])
}

model RemediationRule {
  id        Int         @id @default(autoincrement())
  wasteType WasteType   @map("waste_type")
  level     HazardLevel
  action    String

  @@unique([wasteType, level])
}
```

Waste Reports = Table 4.4: report_id→id SERIAL PK, user_id FK RESTRICT, zone_id FK RESTRICT, waste_type ENUM NOT NULL, severity ENUM NOT NULL, image_url NULL, description TEXT NULL (full-text), status ENUM DEFAULT Pending, reported_at TIMESTAMPTZ NOT NULL.

## Relationships & Constraints

- FK RESTRICT on reports→users/zones, alerts→zones; CASCADE scores→zones.
- `CHECK (score BETWEEN 0 AND 10)`, `CHECK (threshold BETWEEN 0 AND 10)`.
- Native Postgres ENUMs; `In_Progress` maps to "In Progress" label in API.
- PostGIS: `CREATE EXTENSION postgis;` in migration 001; `center = ST_MakePoint(lng,lat)::geography`.

## Indexes (why)

- users(email UNIQUE) — login
- waste_reports(zoneId,status,reportedAt) — dashboard + recompute aggregate
- waste_reports(userId), hazard_scores(zoneId,computedAt DESC), alerts(zoneId,status), zones(currentLevel)
- GIN full-text on description for cause search

## Access Patterns + Redis

- Home: zones + latest scores + active alerts — read-heavy → `GET hz:v1:zones:list TTL 60`, `hz:v1:trend:{days}`. Miss → Postgres → SET. Write (`POST/PATCH reports`) → `DEL hz:v1:zones* hz:v1:trend* hz:v1:zone:{id}`.
- Submit: Prisma `$transaction`: insert report `RETURNING *` + aggregate + insert score + upsert zone. <400ms.
- Trend: range scan scores 30d; cached 60s.

## Migration & Seed

- Prisma: `prisma/schema.prisma` truth; `prisma/migrations/ 001_init (postgis + enums + tables + indexes)`.
- `prisma/seed.ts`: 1 city, 3 users, 20 zones (with center/boundary), 15 remediation rows, 500 reports/6mo.
- Commands: `docker compose up -d postgres redis` → `npx prisma migrate dev` → `npx prisma db seed`.
