import { Card, Typography } from 'antd';
import { palette } from '@/tokens';

const { Title, Paragraph, Text } = Typography;

interface Props {
  title: string;
  /** 1-2 句简介:这个 stub 在最终产品中是干嘛的(供演示态读者理解) */
  desc?: string;
  /** 引用 PRD 章节,例如 "PRD §4.3 + UI-LAYOUT-V1 R2-②"(避免与 React 保留 prop `ref` 冲突,这里叫 refLine) */
  refLine?: string;
}

/**
 * V0.3 layout 骨架阶段统一占位卡片。
 * 所有 stub 页(console/* / admin/* / Me 内 tab 等)用这个包一层,
 * 证明路由 + sidebar + view-context-aware chrome 通即可。
 */
export function StubCard({ title, desc, refLine }: Props) {
  return (
    <Card className="glass-panel" style={{ height: '100%' }}>
      <Title level={3} style={{ color: palette.primary, marginTop: 0 }}>
        {title}
      </Title>
      {desc && (
        <Paragraph style={{ color: palette.textBase }}>{desc}</Paragraph>
      )}
      <Paragraph style={{ color: palette.textMuted, marginBottom: 0 }}>
        <Text style={{ color: palette.textMuted }}>
          V0.3 layout 骨架占位 · 业务功能待 V0.4+ 实施
        </Text>
        {refLine && (
          <Text code style={{ marginLeft: 12, fontSize: 12 }}>
            {refLine}
          </Text>
        )}
      </Paragraph>
    </Card>
  );
}
