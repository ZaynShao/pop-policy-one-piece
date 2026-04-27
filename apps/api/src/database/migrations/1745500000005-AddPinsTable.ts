import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 加 pins 表(PRD §3.3 B7,SPEC-V0.6-beta2-pin §2)
 *
 * - pin_status enum:in_progress / completed / aborted(B9)
 * - pin_priority enum:high / medium / low
 * - pins 表:9 业务 + 4 地理 + created_by FK + 时间戳
 * - 索引:created_by(我的 Pin)/ status / province_code(常用查询)
 */
export class AddPinsTable1745500000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 2 个 enum
    await queryRunner.query(
      `CREATE TYPE "pin_status" AS ENUM ('in_progress', 'completed', 'aborted');`,
    );
    await queryRunner.query(
      `CREATE TYPE "pin_priority" AS ENUM ('high', 'medium', 'low');`,
    );

    // pins 表
    await queryRunner.query(`
      CREATE TABLE "pins" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "title" VARCHAR(100) NOT NULL,
        "description" TEXT NULL,
        "status" "pin_status" NOT NULL DEFAULT 'in_progress',
        "aborted_reason" TEXT NULL,
        "closed_by" UUID NULL,
        "closed_at" TIMESTAMPTZ NULL,
        "priority" "pin_priority" NOT NULL DEFAULT 'medium',
        "province_code" VARCHAR(6) NOT NULL,
        "city_name" VARCHAR(64) NOT NULL,
        "lng" DOUBLE PRECISION NOT NULL,
        "lat" DOUBLE PRECISION NOT NULL,
        "created_by" UUID NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "fk_pins_creator"
          FOREIGN KEY ("created_by") REFERENCES "users"("id")
          ON DELETE RESTRICT,
        CONSTRAINT "fk_pins_closed_by"
          FOREIGN KEY ("closed_by") REFERENCES "users"("id")
          ON DELETE RESTRICT
      );
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_pins_created_by" ON "pins"("created_by");`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_pins_status" ON "pins"("status");`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_pins_province_code" ON "pins"("province_code");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "pins";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "pin_status";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "pin_priority";`);
  }
}
