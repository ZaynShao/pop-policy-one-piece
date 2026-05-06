import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Button, Checkbox, DatePicker, Select, Space, Tooltip, Typography } from 'antd';
import {
  LeftOutlined,
  PlusOutlined,
  PushpinOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import type { Dayjs } from 'dayjs';
import { MapCanvas } from '@/components/MapCanvas';
import { VisitDetailDrawer } from '@/components/VisitDetailDrawer';
import { VisitFormModal } from '@/components/VisitFormModal';
import { PinFormModal } from '@/components/PinFormModal';
import { PinDetailDrawer } from '@/components/PinDetailDrawer';
import { PolicyListDrawer } from '@/components/PolicyListDrawer';
import { fetchPolicyDistribution, fetchPolicyTopics } from '@/api/policies';
import { fetchUsers } from '@/api/users';
import type { UserRoleCode } from '@pop/shared-types';
import { regionCodeToName } from '@/lib/region-names';
import { getTopicColorScale, palette } from '@/tokens';

const { Title, Paragraph } = Typography;

// 5 角色选项(对齐 UserRoleCode enum,demo 演示用)
const ROLE_OPTIONS: Array<{ label: string; value: UserRoleCode }> = [
  { label: '系统管理员', value: 'sys_admin' as UserRoleCode },
  { label: '负责人', value: 'lead' as UserRoleCode },
  { label: 'PMO', value: 'pmo' as UserRoleCode },
  { label: '属地 GA', value: 'local_ga' as UserRoleCode },
  { label: '中台 GA', value: 'central_ga' as UserRoleCode },
];

/**
 * R2-① 大盘视图 layout(/map/local + /map/policy 共用画布)。
 *
 * UI-LAYOUT-V1 §3.1 关键约束:
 * - 双子视图共用画布,切换仅图层 + 左面板(底图状态保持) — §6.1 设计原则:1578
 * - 左面板 = **absolute 浮动玻璃面板**,**不挤压地图**(用户拍 2026-04-25 晚)
 * - ➕📌 浮动按钮 = **圆形图标按钮**(shape="circle" size="large"),
 *   absolute 叠层,贴地图画布内部右下角(§3.6 第 1.5 条 + 用户拍 圆形)
 * - 右抽屉默认收起,点击点(蓝点 / 图钉 / 涂层点)从右滑出
 *
 * V0.4 c1:地图画布接真 ECharts(MapCanvas 组件,35 regions 多边形 + hover
 * 高亮 + click 下钻 console.log);属地态 / 政策态切换不重置 currentProvinceCode
 * (双子视图共用画布,§6.1 设计原则:1578)。业务图层(蓝点 / 图钉 / 涂层)
 * 留给 V0.5+。
 */
export function MapShell() {
  const location = useLocation();
  const isPolicy = location.pathname === '/map/policy';
  const [siderOpen, setSiderOpen] = useState(true);
  const [currentProvinceCode, setCurrentProvinceCode] = useState<string | null>(null);
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [visitModalOpen, setVisitModalOpen] = useState(false);
  const [selectedRegionCode, setSelectedRegionCode] = useState<string | null>(null);
  // P0 染色图层 — 政策主题(单选,跟 themes 涂层并列在左面板)
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [policyDrawerMode, setPolicyDrawerMode] = useState<'national' | 'region' | null>(null);
  // 属地大盘左面板筛选(用户拍 — 时间窗口 / 区划 / 角色)
  const [localDateRange, setLocalDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [localProvinceCodes, setLocalProvinceCodes] = useState<string[]>([]);
  const [localRoleCodes, setLocalRoleCodes] = useState<UserRoleCode[]>([]);

  // 切大盘 / 下钻 / 切主题 都清浮起;按 currentProvinceCode 决定 drawer mode:
  //   - 全国视图(无下钻):national —— 显示该主题国家级政策
  //   - 省下钻视图:region(regionCode=currentProvinceCode)—— 显示该省全部政策
  useEffect(() => {
    setSelectedRegionCode(null);
    if (isPolicy && selectedTopic) {
      setPolicyDrawerMode(currentProvinceCode ? 'region' : 'national');
    } else {
      setPolicyDrawerMode(null);
    }
  }, [isPolicy, currentProvinceCode, selectedTopic]);

  // 拉 users 给「角色筛选」下拉用 + filter visit/pin 时反查 user→role
  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    enabled: !isPolicy,  // 只在属地大盘需要
    staleTime: 5 * 60_000,
  });
  // userId → roleCode 映射,filter 时拿
  const userRoleMap: Record<string, UserRoleCode | null> = {};
  for (const u of usersQuery.data?.data ?? []) {
    userRoleMap[u.id] = u.roleCode;
  }

  // 政策主题下拉 — 政策大盘左面板的可选项
  const policyTopicsQuery = useQuery({
    queryKey: ['policy-topics'],
    queryFn: fetchPolicyTopics,
    enabled: isPolicy,
    staleTime: 5 * 60_000,
  });
  const policyTopics = policyTopicsQuery.data?.data ?? [];

  // 选中政策主题时拉 distribution
  const distributionQuery = useQuery({
    queryKey: ['policy-distribution', selectedTopic],
    queryFn: () => fetchPolicyDistribution(selectedTopic!),
    enabled: isPolicy && !!selectedTopic,
    staleTime: 60_000,
  });
  const policyDistribution = distributionQuery.data?.data ?? null;

  // 当前主题色阶 — 按字典序 index 从 10 色相池分配(≤ 10 个主题不撞色)
  const currentTopicScale = useMemo(
    () => (selectedTopic ? getTopicColorScale(selectedTopic, policyTopics) : null),
    [selectedTopic, policyTopics],
  );

  // 点击地图 region:选了政策主题 → drawer 切到 region;否则什么都不发生
  const handlePolicyRegionSelect = (code: string | null): void => {
    setSelectedRegionCode(code);
    if (!selectedTopic) return;
    if (!code) {
      setPolicyDrawerMode('national');
      return;
    }
    setPolicyDrawerMode('region');
  };

  // 政策 drawer 的 region 信息(map state → drawer prop)
  // - 全国视图点省份:regionCode=省 code, cityName=null
  // - 省下钻未点市:regionCode=currentProvinceCode, cityName=null(整省政策)
  // - 省下钻点市:  regionCode=currentProvinceCode, cityName=市名
  const drawerRegion = useMemo(() => {
    if (policyDrawerMode !== 'region') {
      return { regionCode: null as string | null, cityName: null as string | null };
    }
    if (selectedRegionCode && currentProvinceCode) {
      const cityName = regionCodeToName(selectedRegionCode);
      return { regionCode: currentProvinceCode, cityName: cityName ?? null };
    }
    if (currentProvinceCode) {
      return { regionCode: currentProvinceCode, cityName: null };
    }
    return { regionCode: selectedRegionCode, cityName: null };
  }, [policyDrawerMode, selectedRegionCode, currentProvinceCode]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: 'calc(100vh - 64px)',
        background: palette.bgBase,
        overflow: 'hidden',
      }}
    >
      {/* 地图画布 — 真 ECharts(V0.4 c1) */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <MapCanvas
          provinceCode={currentProvinceCode}
          onProvinceChange={setCurrentProvinceCode}
          onVisitClick={setSelectedVisitId}
          onPinClick={setSelectedPinId}
          policyColoring={isPolicy && selectedTopic ? policyDistribution : null}
          policyColorScale={isPolicy && selectedTopic ? currentTopicScale : null}
          showLocalLayers={!isPolicy}
          selectedRegionCode={isPolicy ? selectedRegionCode : null}
          onRegionSelect={isPolicy ? handlePolicyRegionSelect : undefined}
          localDateRange={
            !isPolicy && localDateRange && localDateRange[0] && localDateRange[1]
              ? [localDateRange[0].format('YYYY-MM-DD'), localDateRange[1].format('YYYY-MM-DD')]
              : null
          }
          localProvinceCodes={!isPolicy ? localProvinceCodes : []}
          localRoleCodes={!isPolicy ? localRoleCodes : []}
          userRoleMap={userRoleMap}
        />
      </div>

      {/* 左面板 — absolute 浮动玻璃面板,不挤压地图(用户拍) */}
      {siderOpen && (
        <div
          className="glass-panel"
          style={{
            position: 'absolute',
            left: 16,
            top: 16,
            bottom: 16,
            width: 360,
            padding: 16,
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            background: palette.bgPanel,
            border: `1px solid ${palette.border}`,
            borderRadius: 12,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <Title level={5} style={{ color: palette.primary, marginTop: 0 }}>
            {isPolicy ? '政策大盘' : '属地大盘 · 热力筛选'}
          </Title>
          {isPolicy ? (
            <>
              <Paragraph style={{ color: palette.textMuted, fontSize: 12, marginBottom: 10 }}>
                选一个主题 → 各省/市按政策数染色 + 国家级浮窗
              </Paragraph>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {policyTopics.map((topic) => {
                    const isSel = selectedTopic === topic;
                    const scale = getTopicColorScale(topic, policyTopics);
                    const accent = scale[3]; // 中亮档作为 checkbox accent(亮一点更清楚)
                    return (
                      <div
                        key={topic}
                        onClick={() => setSelectedTopic(isSel ? null : topic)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '8px 8px', borderRadius: 8,
                          background: isSel ? `${accent}22` : `${accent}0a`,
                          border: `1px solid ${isSel ? `${accent}cc` : `${accent}33`}`,
                          cursor: 'pointer',
                          boxShadow: isSel ? `0 0 12px ${accent}55` : 'none',
                          transition: 'all 0.2s',
                          minWidth: 0,
                        }}
                      >
                        <Checkbox checked={isSel} />
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: accent, boxShadow: `0 0 6px ${accent}`,
                          flexShrink: 0,
                        }} />
                        <Typography.Text strong style={{
                          fontSize: 12, color: palette.textBase,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          flex: 1, minWidth: 0,
                        }}>
                          {topic}
                        </Typography.Text>
                      </div>
                    );
                  })}

                </div>

                {selectedTopic && distributionQuery.isLoading && (
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                    加载分布中…
                  </Typography.Text>
                )}

                {/* 色阶图例 — 选中主题时显示该主题色阶 */}
                {selectedTopic && policyDistribution && currentTopicScale && (
                  <div style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: `${currentTopicScale[2]}10`,
                    border: `1px solid ${currentTopicScale[2]}33`,
                  }}>
                    <Typography.Text style={{ fontSize: 11, color: palette.textMuted, display: 'block', marginBottom: 6 }}>
                      {selectedTopic} · 色阶图例(政策数)
                    </Typography.Text>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 4, columnGap: 8 }}>
                      {[
                        { c: currentTopicScale[0], label: '1 – 2 条' },
                        { c: currentTopicScale[1], label: '3 – 5 条' },
                        { c: currentTopicScale[2], label: '6 – 10 条' },
                        { c: currentTopicScale[3], label: '11 – 20 条' },
                        { c: currentTopicScale[4], label: '21 条以上' },
                      ].map((b) => (
                        <Space key={b.label} size={6}>
                          <span style={{
                            display: 'inline-block', width: 16, height: 10, borderRadius: 2,
                            background: b.c, boxShadow: `0 0 6px ${b.c}66`,
                          }} />
                          <Typography.Text style={{ fontSize: 11, color: palette.textBase }}>
                            {b.label}
                          </Typography.Text>
                        </Space>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Paragraph style={{ color: palette.textMuted, fontSize: 12, marginBottom: 10 }}>
                筛选当前地图上的散点 / 图钉
              </Paragraph>

              {/* 时间窗口 */}
              <div style={{ marginBottom: 10 }}>
                <Typography.Text style={{ fontSize: 11, color: palette.textMuted, display: 'block', marginBottom: 4 }}>
                  时间窗口
                </Typography.Text>
                <DatePicker.RangePicker
                  size="small"
                  value={localDateRange as [Dayjs, Dayjs] | null}
                  onChange={(v) => setLocalDateRange(v as [Dayjs | null, Dayjs | null] | null)}
                  placeholder={['起', '止']}
                  style={{ width: '100%' }}
                />
              </div>

              {/* 区划筛选 — 多选 province */}
              <div style={{ marginBottom: 10 }}>
                <Typography.Text style={{ fontSize: 11, color: palette.textMuted, display: 'block', marginBottom: 4 }}>
                  区划筛选
                </Typography.Text>
                <Select
                  mode="multiple"
                  size="small"
                  allowClear
                  placeholder="全部省份"
                  value={localProvinceCodes}
                  onChange={setLocalProvinceCodes}
                  maxTagCount="responsive"
                  style={{ width: '100%' }}
                  options={Array.from(
                    new Set([
                      // 从 visits + pins 数据里取出现过的 province codes(避免列出 32 个 全国)
                      // 占位简单实现:fallback 到 hardcoded 12 主要省 demo 用
                      '110000', '310000', '440000', '510000', '320000', '330000',
                      '370000', '420000', '430000', '500000', '610000', '350000',
                    ]),
                  ).map((code) => ({
                    label: { '110000': '北京', '310000': '上海', '440000': '广东', '510000': '四川',
                      '320000': '江苏', '330000': '浙江', '370000': '山东', '420000': '湖北',
                      '430000': '湖南', '500000': '重庆', '610000': '陕西', '350000': '福建' }[code] ?? code,
                    value: code,
                  }))}
                />
              </div>

              {/* 角色筛选 — 多选 role */}
              <div style={{ marginBottom: 8 }}>
                <Typography.Text style={{ fontSize: 11, color: palette.textMuted, display: 'block', marginBottom: 4 }}>
                  角色筛选
                </Typography.Text>
                <Select
                  mode="multiple"
                  size="small"
                  allowClear
                  placeholder="全部角色"
                  value={localRoleCodes}
                  onChange={setLocalRoleCodes}
                  maxTagCount="responsive"
                  style={{ width: '100%' }}
                  options={ROLE_OPTIONS}
                  loading={usersQuery.isLoading}
                />
              </div>

              <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 8 }}>
                β.1 32 Visit + β.2 3 Pin · 形状区分
              </Typography.Text>
            </>
          )}
        </div>
      )}

      {/* 左面板 toggle 按钮 — 始终在面板右边缘外的垂直中间(把手位置) */}
      <Tooltip title={siderOpen ? '收起左面板' : '展开左面板'} placement="right">
        <Button
          type="primary"
          icon={siderOpen ? <LeftOutlined /> : <RightOutlined />}
          onClick={() => setSiderOpen((v) => !v)}
          aria-label={siderOpen ? '收起左面板' : '展开左面板'}
          style={{
            position: 'absolute',
            // 开:贴面板右边缘(16 + 280 = 296);收:贴视口左边缘(0,把手露出来)
            left: siderOpen ? 16 + 360 : 0,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 28,
            height: 64,
            padding: 0,
            borderRadius: '0 8px 8px 0', // 右半圆角(把手风)
            zIndex: 11,
            transition: 'left 0.2s ease',
          }}
        />
      </Tooltip>

      {/* ➕📌 圆形浮动按钮组 — absolute 叠层贴画布内部右下角 */}
      <div
        style={{
          position: 'absolute',
          right: 24,
          bottom: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          zIndex: 10,
        }}
      >
        <Tooltip title="新增蓝点" placement="left">
          <Button
            type="primary"
            shape="circle"
            size="large"
            icon={<PlusOutlined />}
            onClick={() => setVisitModalOpen(true)}
            aria-label="新增蓝点"
          />
        </Tooltip>
        <Tooltip title="新增图钉" placement="left">
          <Button
            type="primary"
            shape="circle"
            size="large"
            icon={<PushpinOutlined />}
            onClick={() => setPinModalOpen(true)}
            aria-label="新增图钉"
          />
        </Tooltip>
      </div>

      {/* 大盘 Visit 详情抽屉(β.1 新加 · 散点 click 唤起) */}
      <VisitDetailDrawer
        visitId={selectedVisitId}
        onClose={() => setSelectedVisitId(null)}
      />

      {/* β.3:➕ 新增蓝点(化身 planned visit · 默认计划中) */}
      <VisitFormModal
        open={visitModalOpen}
        onClose={() => setVisitModalOpen(false)}
        defaultStatus="planned"
      />

      {/* β.2:📌 Pin 创建 Modal + 详情 Drawer(散点 click 触发) */}
      <PinFormModal
        open={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
      />

      <PinDetailDrawer
        pinId={selectedPinId}
        onClose={() => setSelectedPinId(null)}
      />

      {/* P0 政策染色 drawer — 选中政策主题时自动开 national,点 region 切到 region */}
      {isPolicy && selectedTopic && (
        <PolicyListDrawer
          topic={selectedTopic}
          mode={policyDrawerMode}
          regionCode={drawerRegion.regionCode}
          cityName={drawerRegion.cityName}
          onClose={() => {
            setPolicyDrawerMode(null);
            setSelectedRegionCode(null);
          }}
        />
      )}

      <Outlet />
    </div>
  );
}
