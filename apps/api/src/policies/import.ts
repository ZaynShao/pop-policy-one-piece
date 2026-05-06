/**
 * 政策大盘 P0 — JSON → policies / policy_topics 入库脚本
 *
 * 用法:
 *   npx ts-node -r tsconfig-paths/register apps/api/src/policies/import.ts <path-to-json>
 *   默认 path = 仓库根 data/policy-distribution-2026-05-06.json
 *
 * 行为:
 *   - TRUNCATE policies, policy_topics CASCADE(演示节奏:每次 import 全量重建)
 *   - 跨主题以 (title, issuing_org, issue_date) 三元组去重 → 一条 policy
 *   - 同一 policy 关联多个主题 → 写 policy_topics
 *   - 校验 6 铁律(字段非空 + 互斥分组 + provinceCode 国标 + level 合法)
 *   - 入参违反则整个 import 拒绝(零容忍,演示阶段不接受脏数据)
 */
import 'reflect-metadata';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import dataSource from '../database/data-source';
import type {
  PolicyLevel,
  TopicDistributionInput,
  PolicyItemInput,
} from '@pop/shared-types';

const NATIONAL_PROVINCE_CODES = new Set([
  '110000', '120000', '130000', '140000', '150000',
  '210000', '220000', '230000',
  '310000', '320000', '330000', '340000', '350000', '360000', '370000',
  '410000', '420000', '430000', '440000', '450000', '460000',
  '500000', '510000', '520000', '530000', '540000',
  '610000', '620000', '630000', '640000', '650000',
]);

const VALID_LEVELS = new Set<PolicyLevel>(['national', 'provincial', 'municipal', 'district']);

interface PolicyRow {
  id: string;
  title: string;
  issuingOrg: string;
  issueDate: string;
  level: PolicyLevel;
  provinceCode: string | null;
  cityName: string | null;
  summary: string;
  sourceBatchId: string;
}

function naturalKey(p: { title: string; issuingOrg: string; issueDate: string }): string {
  return `${p.title}${p.issuingOrg}${p.issueDate}`;
}

function assertNonEmpty(v: unknown, ctx: string): asserts v is string {
  if (typeof v !== 'string' || v.trim() === '') {
    throw new Error(`字段非空校验失败: ${ctx} = ${JSON.stringify(v)}`);
  }
}

function validateAndCollect(
  data: TopicDistributionInput,
  batchId: string,
): { rows: Map<string, PolicyRow>; topicLinks: Array<{ key: string; topic: string }> } {
  const rows = new Map<string, PolicyRow>();
  const topicLinks: Array<{ key: string; topic: string }> = [];

  if (!data.topics || !Array.isArray(data.topics)) {
    throw new Error('JSON 顶层缺少 topics 数组');
  }

  const visit = (
    p: PolicyItemInput,
    topic: string,
    expectGroup: 'national' | 'province' | 'city',
    provinceCode: string | null,
    cityName: string | null,
  ): void => {
    assertNonEmpty(p.title, `${topic}/${expectGroup} title`);
    assertNonEmpty(p.issuingOrg, `${topic}/${expectGroup} issuingOrg @ ${p.title.slice(0, 30)}`);
    assertNonEmpty(p.issueDate, `${topic}/${expectGroup} issueDate @ ${p.title.slice(0, 30)}`);
    assertNonEmpty(p.summary, `${topic}/${expectGroup} summary @ ${p.title.slice(0, 30)}`);
    if (!VALID_LEVELS.has(p.level)) {
      throw new Error(`非法 level=${p.level} @ ${p.title.slice(0, 30)}`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.issueDate)) {
      throw new Error(`issueDate 格式错: ${p.issueDate} @ ${p.title.slice(0, 30)}`);
    }
    // 互斥分组校验:level vs 分组位置
    if (expectGroup === 'national' && p.level !== 'national') {
      throw new Error(`national 组下出现非 national level=${p.level} @ ${p.title.slice(0, 30)}`);
    }
    if (expectGroup === 'province' && p.level !== 'provincial') {
      throw new Error(`byProvince 组下出现非 provincial level=${p.level} @ ${p.title.slice(0, 30)}`);
    }
    if (expectGroup === 'city' && p.level !== 'municipal' && p.level !== 'district') {
      throw new Error(`byCity 组下出现非 municipal/district level=${p.level} @ ${p.title.slice(0, 30)}`);
    }

    const key = naturalKey(p);
    let row = rows.get(key);
    if (!row) {
      row = {
        id: randomUUID(),
        title: p.title,
        issuingOrg: p.issuingOrg,
        issueDate: p.issueDate,
        level: p.level,
        provinceCode,
        cityName,
        summary: p.summary,
        sourceBatchId: batchId,
      };
      rows.set(key, row);
    } else {
      // 跨主题重复 — 校验 level/provinceCode/cityName 一致
      if (row.level !== p.level || row.provinceCode !== provinceCode || row.cityName !== cityName) {
        throw new Error(
          `同一政策 (${p.title.slice(0, 30)}...) 在不同主题下 level/region 不一致:` +
            ` ${row.level}@${row.provinceCode}/${row.cityName} vs ${p.level}@${provinceCode}/${cityName}`,
        );
      }
    }
    topicLinks.push({ key, topic });
  };

  for (const t of data.topics) {
    assertNonEmpty(t.topic, 'topic name');
    for (const p of t.national ?? []) visit(p, t.topic, 'national', null, null);
    for (const grp of t.byProvince ?? []) {
      if (!NATIONAL_PROVINCE_CODES.has(grp.provinceCode)) {
        throw new Error(`byProvince provinceCode 非国标: ${grp.provinceCode} (${grp.provinceName})`);
      }
      for (const p of grp.policies ?? []) {
        visit(p, t.topic, 'province', grp.provinceCode, null);
      }
    }
    for (const grp of t.byCity ?? []) {
      if (!NATIONAL_PROVINCE_CODES.has(grp.provinceCode)) {
        throw new Error(`byCity provinceCode 非国标: ${grp.provinceCode} (${grp.cityName})`);
      }
      assertNonEmpty(grp.cityName, `byCity cityName @ ${grp.provinceCode}`);
      for (const p of grp.policies ?? []) {
        visit(p, t.topic, 'city', grp.provinceCode, grp.cityName);
      }
    }
  }

  return { rows, topicLinks };
}

async function main(): Promise<void> {
  const argPath = process.argv[2];
  const filePath = argPath
    ? (argPath.startsWith('/') ? argPath : join(process.cwd(), argPath))
    : join(__dirname, '../../../../data/policy-distribution-2026-05-06.json');

  console.log(`[policies-import] 读 JSON: ${filePath}`);
  const raw = readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw) as TopicDistributionInput;
  console.log(`[policies-import] fetchedAt=${data.fetchedAt}, topics=${data.topics?.length ?? 0}`);

  const batchId = randomUUID();
  const { rows, topicLinks } = validateAndCollect(data, batchId);
  console.log(
    `[policies-import] 校验通过: ${rows.size} 条政策(去重后), ${topicLinks.length} 条 topic 关联`,
  );

  await dataSource.initialize();
  console.log('[policies-import] DB 连接成功');

  await dataSource.transaction(async (mgr) => {
    await mgr.query('TRUNCATE TABLE "policy_topics", "policies" CASCADE;');
    console.log('[policies-import] TRUNCATE 完成');

    const policyValues = [...rows.values()];
    const CHUNK = 200;
    for (let i = 0; i < policyValues.length; i += CHUNK) {
      const chunk = policyValues.slice(i, i + CHUNK);
      await mgr.query(
        `INSERT INTO "policies"
          ("id","title","issuing_org","issue_date","level","province_code","city_name","summary","source_batch_id")
         VALUES ${chunk
           .map(
             (_, idx) =>
               `($${idx * 9 + 1},$${idx * 9 + 2},$${idx * 9 + 3},$${idx * 9 + 4},$${idx * 9 + 5},$${idx * 9 + 6},$${idx * 9 + 7},$${idx * 9 + 8},$${idx * 9 + 9})`,
           )
           .join(',')}`,
        chunk.flatMap((r) => [
          r.id,
          r.title,
          r.issuingOrg,
          r.issueDate,
          r.level,
          r.provinceCode,
          r.cityName,
          r.summary,
          r.sourceBatchId,
        ]),
      );
    }
    console.log(`[policies-import] 插入 policies: ${policyValues.length}`);

    // policy_topics 也去重(同一 policy + topic 不会插两次,理论上 visit 已保证但 PK 兜底)
    const seen = new Set<string>();
    const uniqLinks: Array<{ policyId: string; topic: string }> = [];
    for (const link of topicLinks) {
      const row = rows.get(link.key)!;
      const k = `${row.id}:${link.topic}`;
      if (seen.has(k)) continue;
      seen.add(k);
      uniqLinks.push({ policyId: row.id, topic: link.topic });
    }
    for (let i = 0; i < uniqLinks.length; i += CHUNK) {
      const chunk = uniqLinks.slice(i, i + CHUNK);
      await mgr.query(
        `INSERT INTO "policy_topics" ("policy_id","topic") VALUES ${chunk
          .map((_, idx) => `($${idx * 2 + 1},$${idx * 2 + 2})`)
          .join(',')}`,
        chunk.flatMap((l) => [l.policyId, l.topic]),
      );
    }
    console.log(`[policies-import] 插入 policy_topics: ${uniqLinks.length}`);
  });

  // 统计
  const stats = await dataSource.query(`
    SELECT pt.topic,
           COUNT(*) FILTER (WHERE p.level = 'national') AS national,
           COUNT(*) FILTER (WHERE p.level = 'provincial') AS provincial,
           COUNT(*) FILTER (WHERE p.level IN ('municipal','district')) AS city,
           COUNT(*) AS total
    FROM "policy_topics" pt
    JOIN "policies" p ON p.id = pt.policy_id
    GROUP BY pt.topic
    ORDER BY pt.topic;
  `);
  console.log('\n[policies-import] 入库统计:');
  for (const r of stats) {
    console.log(
      `  ${String(r.topic).padEnd(20)} national=${r.national}  provincial=${r.provincial}  city=${r.city}  total=${r.total}`,
    );
  }
  console.log(`\n[policies-import] batch_id = ${batchId}`);

  await dataSource.destroy();
}

main().catch((err) => {
  console.error('[policies-import] 失败:', err);
  process.exit(1);
});
