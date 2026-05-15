import { useState } from 'react';
import {
  Button,
  Card,
  Descriptions,
  Drawer,
  Modal,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserRoleCode, type Visit, type UpdateVisitInput } from '@pop/shared-types';
import { VisitFormModal } from './VisitFormModal';
import { ToolListInDrawer } from '@/components/tools/ToolListInDrawer';
import { deleteVisit } from '@/api/visits';
import { authHeaders } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

const VISIT_DELETE_ALLOWED_ROLES: ReadonlySet<UserRoleCode> = new Set([
  UserRoleCode.SysAdmin,
  UserRoleCode.Lead,
  UserRoleCode.Pmo,
]);

const { Text } = Typography;

const COLOR_TAG: Record<'red' | 'yellow' | 'green', { color: string; label: string }> = {
  green: { color: 'green', label: '常规' },
  yellow: { color: 'gold', label: '层级提升' },
  red: { color: 'orange', label: '紧急' },
};

const COLOR_OPTIONS = [
  { label: '绿(常规)', value: 'green' },
  { label: '黄(层级提升)', value: 'yellow' },
  { label: '红(紧急)', value: 'red' },
];

interface Props {
  visitId: string | null;
  onClose: () => void;
}

async function fetchVisit(id: string): Promise<{ data: Visit }> {
  const r = await fetch(`/api/v1/visits/${id}`, { headers: authHeaders() });
  if (!r.ok) throw new Error('visit detail fetch fail');
  return r.json();
}

async function putVisit(id: string, body: UpdateVisitInput): Promise<void> {
  const r = await fetch(`/api/v1/visits/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message ?? 'update fail');
  }
}

export function VisitDetailDrawer({ visitId, onClose }: Props) {
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const canDelete = currentUser ? VISIT_DELETE_ALLOWED_ROLES.has(currentUser.roleCode) : false;
  const [editOpen, setEditOpen] = useState(false);
  // editFormVisit: allows overriding status when opening modal (e.g. planned → completed)
  const [editFormVisit, setEditFormVisit] = useState<Visit | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['visit', visitId],
    queryFn: () => fetchVisit(visitId as string),
    enabled: !!visitId,
  });

  const visit = data?.data;

  const statusMutation = useMutation({
    mutationFn: (body: UpdateVisitInput) => putVisit(visitId as string, body),
    onSuccess: () => {
      message.success('状态已更新');
      qc.invalidateQueries({ queryKey: ['visits'] });
      qc.invalidateQueries({ queryKey: ['visit', visitId] });
    },
    onError: (err) => message.error(`操作失败: ${(err as Error).message}`),
  });

  const colorMutation = useMutation({
    mutationFn: (color: 'red' | 'yellow' | 'green') =>
      putVisit(visitId as string, { color }),
    onSuccess: () => {
      message.success('颜色已更新');
      qc.invalidateQueries({ queryKey: ['visits'] });
      qc.invalidateQueries({ queryKey: ['visit', visitId] });
      qc.invalidateQueries({ queryKey: ['pins'] });
      qc.invalidateQueries({ queryKey: ['pin-comments'] });
    },
    onError: (err) => message.error(`保存失败: ${(err as Error).message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteVisit(visitId as string),
    onSuccess: () => {
      message.success('已删除');
      qc.invalidateQueries({ queryKey: ['visits'] });
      onClose();
    },
    onError: (err) => message.error(`删除失败: ${(err as Error).message}`),
  });

  const handleDelete = () => {
    Modal.confirm({
      title: '删除拜访',
      content: '软删除:此条拜访会从大盘和清单消失,关联的 Pin 留言不动。回收站可还原。',
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => deleteMutation.mutateAsync(),
    });
  };

  const handleCancelPlan = () => {
    Modal.confirm({
      title: '取消计划',
      content: '确认将此拜访计划标记为「已取消」?',
      okText: '确认取消',
      cancelText: '返回',
      okButtonProps: { danger: true },
      onOk: () => statusMutation.mutateAsync({ status: 'cancelled' }),
    });
  };

  const handleRestart = () => {
    statusMutation.mutate({ status: 'planned' });
  };

  const handleConvertToCompleted = () => {
    if (!visit) return;
    // Pass a copy of visit with status forced to 'completed' so VisitFormModal
    // initializes the Segmented to the completed tab.
    setEditFormVisit({ ...visit, status: 'completed' });
    setEditOpen(true);
  };

  const handleEditClose = () => {
    setEditOpen(false);
    setEditFormVisit(null);
    // Refresh after modal saves
    qc.invalidateQueries({ queryKey: ['visit', visitId] });
  };

  // Derive status tag
  const statusTag = () => {
    if (!visit) return null;
    if (visit.status === 'planned') {
      return <Tag color="blue">计划中</Tag>;
    }
    if (visit.status === 'cancelled') {
      return <Tag color="default">已取消</Tag>;
    }
    // completed — color based on visit.color
    const c = visit.color;
    if (c && c !== 'blue' && COLOR_TAG[c]) {
      return <Tag color={COLOR_TAG[c].color}>已拜访</Tag>;
    }
    return <Tag color="blue">已拜访</Tag>;
  };

  return (
    <>
      <Drawer
        title={
          visit ? (
            <Space>
              <Text strong style={{ fontSize: 15 }}>{visit.title ?? visit.cityName}</Text>
              {statusTag()}
            </Space>
          ) : '加载中…'
        }
        placement="right"
        width={440}
        open={!!visitId}
        onClose={onClose}
        destroyOnClose
      >
        {isLoading || !visit ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spin /></div>
        ) : (
          <>
            {/* ── planned 状态按钮组 ── */}
            {visit.status === 'planned' && (
              <Space style={{ marginBottom: 16 }} wrap>
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={handleConvertToCompleted}
                >
                  转为已拜访
                </Button>
                <Button
                  danger
                  icon={<CloseCircleOutlined />}
                  loading={statusMutation.isPending}
                  onClick={handleCancelPlan}
                >
                  取消计划
                </Button>
                {canDelete && (
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    loading={deleteMutation.isPending}
                    onClick={handleDelete}
                  >
                    删除
                  </Button>
                )}
              </Space>
            )}

            {/* ── cancelled 状态按钮组 ── */}
            {visit.status === 'cancelled' && (
              <Space style={{ marginBottom: 16 }} wrap>
                <Button
                  type="primary"
                  icon={<ReloadOutlined />}
                  loading={statusMutation.isPending}
                  onClick={handleRestart}
                >
                  重启为计划中
                </Button>
                {canDelete && (
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    loading={deleteMutation.isPending}
                    onClick={handleDelete}
                  >
                    删除
                  </Button>
                )}
              </Space>
            )}

            {/* ── completed 状态按钮组(只有删除)── */}
            {visit.status === 'completed' && canDelete && (
              <Space style={{ marginBottom: 16 }} wrap>
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  loading={deleteMutation.isPending}
                  onClick={handleDelete}
                >
                  删除
                </Button>
              </Space>
            )}

            {/* ── planned 详情 ── */}
            {visit.status === 'planned' && (
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="标题">
                  {visit.title ?? <Text type="secondary">—</Text>}
                </Descriptions.Item>
                <Descriptions.Item label="拜访人">
                  {visit.visitorName ?? <Text type="secondary">—</Text>}
                </Descriptions.Item>
                <Descriptions.Item label="随行人">
                  {visit.accompaniedBy && visit.accompaniedBy.length > 0
                    ? visit.accompaniedBy.join('、')
                    : <Text type="secondary">—</Text>}
                </Descriptions.Item>
                <Descriptions.Item label="计划日期">
                  {visit.plannedDate ?? <Text type="secondary">—</Text>}
                </Descriptions.Item>
                {visit.parentPinId && (
                  <Descriptions.Item label="关联 Pin">
                    <Text type="secondary">{visit.parentPinId.slice(0, 8)}…</Text>
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="省市">
                  {visit.cityName}({visit.provinceCode})
                </Descriptions.Item>
                <Descriptions.Item label="坐标">
                  {visit.lng.toFixed(4)}, {visit.lat.toFixed(4)}
                </Descriptions.Item>
              </Descriptions>
            )}

            {/* ── completed 详情 ── */}
            {visit.status === 'completed' && (
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="拜访人">
                  {visit.visitorName ?? <Text type="secondary">—</Text>}
                </Descriptions.Item>
                <Descriptions.Item label="随行人">
                  {visit.accompaniedBy && visit.accompaniedBy.length > 0
                    ? visit.accompaniedBy.join('、')
                    : <Text type="secondary">—</Text>}
                </Descriptions.Item>
                <Descriptions.Item label="拜访日期">
                  {visit.visitDate ?? <Text type="secondary">—</Text>}
                </Descriptions.Item>
                <Descriptions.Item label="对接部门">
                  {visit.department ?? <Text type="secondary">—</Text>}
                </Descriptions.Item>
                <Descriptions.Item label="对接人">
                  {visit.contactPerson ?? <Text type="secondary">—</Text>}
                </Descriptions.Item>
                <Descriptions.Item label="对接人职务">
                  {visit.contactTitle ?? <Text type="secondary">—</Text>}
                </Descriptions.Item>
                <Descriptions.Item label="产出描述">
                  {visit.outcomeSummary ?? <Text type="secondary">—</Text>}
                </Descriptions.Item>
                <Descriptions.Item label="颜色">
                  <Select
                    size="small"
                    style={{ width: 140 }}
                    value={visit.color === 'blue' || !visit.color ? undefined : visit.color}
                    options={COLOR_OPTIONS}
                    loading={colorMutation.isPending}
                    onChange={(v) => colorMutation.mutate(v as 'red' | 'yellow' | 'green')}
                    placeholder="选择颜色"
                  />
                </Descriptions.Item>
                <Descriptions.Item label="后续跟进">
                  {visit.followUp ? '是' : '否'}
                </Descriptions.Item>
                {visit.parentPinId && (
                  <Descriptions.Item label="关联 Pin">
                    <Text type="secondary">{visit.parentPinId.slice(0, 8)}…</Text>
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="省市">
                  {visit.cityName}({visit.provinceCode})
                </Descriptions.Item>
              </Descriptions>
            )}

            {/* ── cancelled 详情 ── */}
            {visit.status === 'cancelled' && (
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="标题">
                  {visit.title ?? <Text type="secondary">—</Text>}
                </Descriptions.Item>
                <Descriptions.Item label="拜访人">
                  {visit.visitorName ?? <Text type="secondary">—</Text>}
                </Descriptions.Item>
                <Descriptions.Item label="计划日期">
                  {visit.plannedDate ?? <Text type="secondary">—</Text>}
                </Descriptions.Item>
                <Descriptions.Item label="省市">
                  {visit.cityName}({visit.provinceCode})
                </Descriptions.Item>
                <Descriptions.Item label="状态说明">
                  <Text type="secondary">此拜访计划已取消,可重启为计划中。</Text>
                </Descriptions.Item>
              </Descriptions>
            )}

            {/* ── 可用工具(planned/completed 展示,cancelled 不展示)── */}
            {(visit.status === 'planned' || visit.status === 'completed') && (
              <Card size="small" title="可用工具" style={{ marginTop: 12 }}>
                <ToolListInDrawer
                  visitId={visit.id}
                  contextRegionCode={visit.provinceCode ?? undefined}
                />
              </Card>
            )}
          </>
        )}
      </Drawer>

      {editFormVisit && (
        <VisitFormModal
          open={editOpen}
          onClose={handleEditClose}
          editing={editFormVisit}
        />
      )}
    </>
  );
}
