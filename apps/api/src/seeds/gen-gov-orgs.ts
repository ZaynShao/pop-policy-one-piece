/**
 * 生成 GovOrg seed JSON。
 * 用法:cd apps/api && npm run seed:gov-orgs:gen
 * 产出:apps/api/src/seeds/gov-orgs-seed.json
 */
import { writeFileSync } from 'fs';
import { join } from 'path';
import { STATE_COUNCIL_DEPTS } from './data/state-council-depts';
import { PROVINCES, PROVINCIAL_DEPT_TEMPLATE, type ProvinceMeta } from './data/provincial-template';
import { STANDALONE_CITIES } from './data/standalone-cities';
import { FULL_PROVINCES } from './data/full-provinces';

interface GovOrgSeedRow {
  name: string;
  shortName: string;
  provinceCode: string;
  cityName: string;
  level: 'national' | 'provincial' | 'municipal';
  functionTags: string[];
}

/** 直辖市的「厅」改成「局」,自治区保留 */
function provincialSuffixFor(p: ProvinceMeta, suffix: string): string {
  if (p.kind === 'municipality') return suffix.replace('厅', '局');
  return suffix;
}

/** 市级一律「厅」改「局」 */
function municipalSuffix(suffix: string): string {
  return suffix.replace('厅', '局');
}

function generate(): GovOrgSeedRow[] {
  const orgs: GovOrgSeedRow[] = [];

  // 1) 国务院 25 部委
  for (const d of STATE_COUNCIL_DEPTS) {
    orgs.push({
      name: d.name,
      shortName: d.shortName,
      provinceCode: '000000', // 中央特殊码
      cityName: '北京市',
      level: 'national',
      functionTags: d.tags,
    });
  }

  // 2) 31 省级 × 7 口
  for (const p of PROVINCES) {
    for (const t of PROVINCIAL_DEPT_TEMPLATE) {
      const suffix = provincialSuffixFor(p, t.suffix);
      orgs.push({
        name: `${p.fullLabel}${suffix}`,
        shortName: `${p.shortLabel}${t.short.replace('厅', p.kind === 'municipality' ? '局' : '厅')}`,
        provinceCode: p.code,
        cityName: p.capital,
        level: 'provincial',
        functionTags: t.tags,
      });
    }
  }

  // 3) 13 独立城市 × 7 口
  for (const c of STANDALONE_CITIES) {
    for (const t of PROVINCIAL_DEPT_TEMPLATE) {
      orgs.push({
        name: `${c.cityName}${municipalSuffix(t.suffix)}`,
        shortName: `${c.shortLabel}${t.short.replace('厅', '局')}`,
        provinceCode: c.provinceCode,
        cityName: c.cityName,
        level: 'municipal',
        functionTags: t.tags,
      });
    }
  }

  // 4) 4 全省地市级
  for (const [provinceCode, cities] of Object.entries(FULL_PROVINCES)) {
    for (const cityName of cities) {
      // 跳过已在 STANDALONE_CITIES 的城市(避免 UNIQUE 冲突)
      const isStandalone = STANDALONE_CITIES.some(
        (s) => s.provinceCode === provinceCode && s.cityName === cityName,
      );
      if (isStandalone) continue;

      const shortLabel = cityName.replace(/市$|自治州$|地区$/, '');
      for (const t of PROVINCIAL_DEPT_TEMPLATE) {
        orgs.push({
          name: `${cityName}${municipalSuffix(t.suffix)}`,
          shortName: `${shortLabel}${t.short.replace('厅', '局')}`,
          provinceCode,
          cityName,
          level: 'municipal',
          functionTags: t.tags,
        });
      }
    }
  }

  return orgs;
}

const data = generate();
const outPath = join(__dirname, 'gov-orgs-seed.json');
writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');
console.log(`Generated ${data.length} gov_orgs to ${outPath}`);
