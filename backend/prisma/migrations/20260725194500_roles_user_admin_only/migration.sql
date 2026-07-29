-- Normalize legacy roles before shrinking enum
UPDATE "users" SET "role" = 'USER' WHERE "role"::text IN ('ORGANIZER', 'HOST');

-- Rebuild Role enum as USER + ADMIN only
ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role");
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'USER';
DROP TYPE "Role_old";
