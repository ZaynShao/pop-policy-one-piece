import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Button, Checkbox, Space, Tag, Tooltip, Typography } from 'antd';
import {
  LeftOutlined,
  PlusOutlined,
  PushpinOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { MapCanvas } from '@/components/MapCanvas';
import type { ThemeOverlay } from '@/components/MapCanvas';
import { VisitDetailDrawer } from '@/components/VisitDetailDrawer';
import { VisitFormModal } from '@/components/VisitFormModal';
import { PinFormModal } from '@/components/PinFormModal';
import { PinDetailDrawer } from '@/components/PinDetailDrawer';
import { fetchThemes, fetchTheme } from '@/api/themes';
import type { Theme, ThemeWithCoverage } from '@pop/shared-types';
import { palette } from '@/tokens';

const { Title, Paragraph } = Typography;

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
  const [selectedThemeIds, setSelectedThemeIds] = useState<string[]>([]);

  // 拉 published themes 给 Select options(只在 isPolicy 时拉)
  const publishedThemes = useQuery({
    queryKey: ['themes', 'published'],
    queryFn: () => fetchThemes({ status: 'published' }),
    enabled: isPolicy,
  });

  // 拉每个选中 theme 的完整信息(含 coverage)
  const themeOverlaysData = useQuery({
    queryKey: ['theme-overlays', selectedThemeIds],
    queryFn: async () => {
      if (selectedThemeIds.length === 0) return [];
      const fetched = await Promise.all(selectedThemeIds.map((id) => fetchTheme(id)));
      return fetched.map((r) => r.data);
    },
    enabled: isPolicy && selectedThemeIds.length > 0,
  });

  const themeOverlays: ThemeOverlay[] = (themeOverlaysData.data ?? []).map((t: ThemeWithCoverage) => ({
    themeId: t.id,
    themeTitle: t.title,
    template: t.template,
    coverage: t.coverage,
  }));

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
          themeOverlays={isPolicy ? themeOverlays : undefined}
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
            width: 280,
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
            {isPolicy ? '政策大盘 · 涂层勾选' : '属地大盘 · 热力筛选'}
          </Title>
          {isPolicy ? (
            <>
              <Paragraph style={{ color: palette.textMuted, fontSize: 12, marginBottom: 8 }}>
                勾选后在地图上叠加覆盖(最多 3 层)
              </Paragraph>
              <Space size={6} style={{ marginBottom: 12 }}>
                <Button
                  size="small"
                  onClick={() => {
                    const ids = (publishedThemes.data?.data ?? []).slice(0, 3).map((t: Theme) => t.id);
                    setSelectedThemeIds(ids);
                  }}
                >
                  全选
                </Button>
                <Button size="small" onClick={() => setSelectedThemeIds([])}>
                  清空
                </Button>
              </Space>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(publishedThemes.data?.data ?? []).map((t: Theme) => {
                  const isSel = selectedThemeIds.includes(t.id);
                  const themeColor = t.template === 'main' ? '#52c41a' : '#ff4d4f';
                  const reachLimit = !isSel && selectedThemeIds.length >= 3;
                  return (
                    <div
                      key={t.id}
                      onClick={() => {
                        if (reachLimit) return;
                        setSelectedThemeIds((prev) =>
                          prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id],
                        );
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        padding: 10,
                        borderRadius: 8,
                        background: isSel
                          ? `${themeColor}22`
                          : 'rgba(0, 212, 255, 0.03)',
                        border: `1px solid ${isSel ? `${themeColor}aa` : 'rgba(0, 212, 255, 0.08)'}`,
                        cursor: reachLimit ? 'not-allowed' : 'pointer',
                        opacity: reachLimit ? 0.45 : 1,
                        boxShadow: isSel ? `0 0 12px ${themeColor}33` : 'none',
                        transition: 'all 0.2s',
                      }}
                    >
                      <Checkbox checked={isSel} disabled={reachLimit} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Space size={6} wrap>
                          <span
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              background: themeColor,
                              boxShadow: `0 0 6px ${themeColor}`,
                              display: 'inline-block',
                            }}
                          />
                          <Typography.Text
                            strong
                            style={{ fontSize: 13, color: palette.textBase }}
                          >
                            {t.title}
                          </Typography.Text>
                          <Tag
                            color={t.template === 'main' ? 'green' : 'red'}
                            style={{ fontSize: 10, margin: 0, lineHeight: '16px' }}
                          >
                            {t.template === 'main' ? '主线' : '风险'}
                          </Tag>
                        </Space>
                        {t.regionScope && (
                          <div style={{ fontSize: 11, color: palette.textMuted, marginTop: 4, lineHeight: 1.5 }}>
                            {t.regionScope}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {(publishedThemes.data?.data ?? []).length === 0 && (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    暂无已发布主题
                  </Typography.Text>
                )}
              </div>
            </>
          ) : (
            <Paragraph style={{ color: palette.textMuted, fontSize: 12, whiteSpace: 'pre-line' }}>
              {`· 时间窗口\n· 区划筛选\n· 角色筛选\n· (β.1 32 Visit + β.2 3 Pin · 形状区分)`}
            </Paragraph>
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
            left: siderOpen ? 16 + 280 : 0,
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

      <Outlet />
    </div>
  );
}
