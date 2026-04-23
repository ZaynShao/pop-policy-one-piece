import { useMemo, useState } from 'react';
import {
  Table,
  Space,
  Select,
  DatePicker,
  Button,
  Tag,
  Typography,
  Card,
  Empty,
  Tooltip,
  Alert,
} from 'antd';
import { DownloadOutlined, EditOutlined, WarningFilled } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { useVisitStore } from '@/stores/visitStore';
import { usePolicyStore } from '@/stores/policyStore';
import { useAuthStore } from '@/stores/authStore';
import { REGIONS } from '@/mock/regions';
import { VISIT_COLOR_HEX, VISIT_COLOR_LABEL, type VisitRecord } from '@/types';
import VisitDialog from '@/components/dialogs/VisitDialog';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

function isIncomplete(v: VisitRecord): boolean {
  return !v.provinceCode || !v.cityCode || !v.department || !v.content;
}

export default function ExpansionList() {
  const visits = useVisitStore((s) => s.visits);
  const policies = usePolicyStore((s) => s.policies);
  const users = useAuthStore((s) => s.users);
  const [provinceCode, setProvinceCode] = useState<string | undefined>();
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [onlyMine, setOnlyMine] = useState(false);
  const [showIncomplete, setShowIncomplete] = useState(false);
  const [editing, setEditing] = useState<VisitRecord | null>(null);
  const currentUser = useAuthStore((s) => s.user);

  const filtered = useMemo(() => {
    return visits.filter((v) => {
      if (provinceCode && v.provinceCode !== provinceCode) return false;
      if (onlyMine && currentUser && v.userId !== currentUser.id) return false;
      if (range) {
        const ts = dayjs(v.visitedAt ?? v.plannedAt ?? v.createdAt);
        if (ts.isBefore(range[0]) || ts.isAfter(range[1])) return false;
      }
      if (showIncomplete && !isIncomplete(v)) return false;
      return true;
    });
  }, [visits, provinceCode, range, onlyMine, showIncomplete, currentUser]);

  const incompleteCount = useMemo(
    () =>
      visits.filter((v) => {
        if (currentUser && v.userId !== currentUser.id) return false;
        const ts = dayjs(v.visitedAt ?? v.plannedAt ?? v.createdAt);
        if (ts.isBefore(dayjs().subtract(30, 'day'))) return false;
        return isIncomplete(v);
      }).length,
    [visits, currentUser],
  );

  const exportCSV = () => {
    const header = [
      '创建人',
      '省',
      '市',
      '区',
      '部门',
      '对接人',
      '状态',
      '颜色',
      '政策',
      '内容',
      '时间',
    ];
    const rows = filtered.map((v) => [
      users.find((u) => u.id === v.userId)?.nickname ?? v.userId,
      v.provinceName,
      v.cityName,
      v.districtName ?? '',
      v.department,
      v.contactPerson ?? '',
      v.status === 'completed' ? '已完成' : '计划',
      VISIT_COLOR_LABEL[v.color],
      v.policyIds
        .map((pid) => policies.find((p) => p.id === pid)?.name ?? pid)
        .join(' / '),
      v.content.replace(/[\r\n,]/g, ' '),
      dayjs(v.visitedAt ?? v.plannedAt ?? v.createdAt).format('YYYY-MM-DD HH:mm'),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `拓展清单_${dayjs().format('YYYYMMDD_HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns = [
    {
      title: '地区',
      key: 'region',
      width: 180,
      render: (_: any, v: VisitRecord) => (
        <Space direction="vertical" size={0}>
          <Text strong>
            {v.provinceName} · {v.cityName}
          </Text>
          {v.districtName && <Text type="secondary">{v.districtName}</Text>}
        </Space>
      ),
    },
    {
      title: '部门 / 对接人',
      key: 'dept',
      render: (_: any, v: VisitRecord) => (
        <Space direction="vertical" size={0}>
          <span>{v.department || <Text type="danger">（未填）</Text>}</span>
          {v.contactPerson && <Text type="secondary">{v.contactPerson}</Text>}
        </Space>
      ),
    },
    {
      title: '状态',
      key: 'status',
      width: 90,
      render: (_: any, v: VisitRecord) => (
        <Tag color={VISIT_COLOR_HEX[v.color]} style={{ color: '#fff' }}>
          {v.status === 'completed' ? '已完成' : '计划'}
        </Tag>
      ),
    },
    {
      title: '政策',
      dataIndex: 'policyIds',
      width: 180,
      render: (ids: string[]) =>
        ids.map((pid) => {
          const p = policies.find((x) => x.id === pid);
          if (!p) return null;
          return (
            <Tag key={pid} color={p.color}>
              {p.name}
            </Tag>
          );
        }),
    },
    {
      title: '创建人',
      dataIndex: 'userId',
      width: 90,
      render: (id: string) => users.find((u) => u.id === id)?.nickname ?? id,
    },
    {
      title: '时间',
      key: 'time',
      width: 150,
      render: (_: any, v: VisitRecord) =>
        dayjs(v.visitedAt ?? v.plannedAt ?? v.createdAt).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '内容',
      dataIndex: 'content',
      ellipsis: true,
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      fixed: 'right' as const,
      render: (_: any, v: VisitRecord) => (
        <Space>
          {isIncomplete(v) && (
            <Tooltip title="信息不完整，点击修订">
              <WarningFilled style={{ color: '#faad14' }} />
            </Tooltip>
          )}
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => setEditing(v)}
          >
            编辑
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, height: '100%', overflowY: 'auto' }}>
      <Title level={4} style={{ marginTop: 0 }}>
        拓展清单
      </Title>
      {incompleteCount > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message={`过去 30 天有 ${incompleteCount} 条你的记录信息不完整，建议补充`}
          action={
            <Button
              size="small"
              type="primary"
              onClick={() => {
                setShowIncomplete(true);
                setOnlyMine(true);
              }}
            >
              一键修订
            </Button>
          }
        />
      )}
      <Card styles={{ body: { padding: 16 } }}>
        <Space wrap style={{ marginBottom: 12 }}>
          <Select
            placeholder="按省份筛选"
            allowClear
            style={{ width: 200 }}
            value={provinceCode}
            onChange={setProvinceCode}
            options={REGIONS.map((p) => ({ value: p.code, label: p.name }))}
            showSearch
            optionFilterProp="label"
          />
          <RangePicker
            value={range as any}
            onChange={(vals) => setRange(vals as any)}
            presets={[
              { label: '近 7 天', value: [dayjs().subtract(7, 'day'), dayjs()] },
              { label: '近 30 天', value: [dayjs().subtract(30, 'day'), dayjs()] },
            ]}
          />
          <Button
            type={onlyMine ? 'primary' : 'default'}
            onClick={() => setOnlyMine((v) => !v)}
          >
            只看我的
          </Button>
          <Button
            type={showIncomplete ? 'primary' : 'default'}
            danger={showIncomplete}
            onClick={() => setShowIncomplete((v) => !v)}
          >
            仅不完整
          </Button>
          <Button icon={<DownloadOutlined />} onClick={exportCSV}>
            导出 CSV
          </Button>
        </Space>
        <Table
          rowKey="id"
          size="middle"
          dataSource={filtered}
          columns={columns}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          scroll={{ x: 1100 }}
          locale={{ emptyText: <Empty description="暂无记录" /> }}
        />
      </Card>
      <VisitDialog
        open={!!editing}
        editing={editing}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}
