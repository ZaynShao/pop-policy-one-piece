import { useState } from 'react';
import {
  Button,
  Descriptions,
  Drawer,
  Input,
  Modal,
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
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Pin, PinStatus, UpdatePinInput } from '@pop/shared-types';
import { PinFormModal } from './PinFormModal';
import { VisitFormModal } from './VisitFormModal';
import { PinCommentBoard } from './PinCommentBoard';
import { authHeaders } from '@/lib/api';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

const STATUS_TAG: Record<PinStatus, { color: string; label: string }> = {
  in_progress: { color: 'purple', label: '进行中' },
  completed: { color: 'default', label: '完成' },
  aborted: { color: 'default', label: '中止' },
};

const PRIORITY_TAG: Record<Pin['priority'], { color: string; label: string }> = {
  high: { color: 'red', label: '高' },
  medium: { color: 'orange', label: '中' },
  low: { color: 'green', label: '低' },
};

interface Props {
  pinId: string | null;
  onClose: () => void;
}

async function fetchPin(id: string): Promise<{ data: Pin }> {
  const r = await fetch(`/api/v1/pins/${id}`, { headers: authHeaders() });
  if (!r.ok) throw new Error('pin detail fetch fail');
  return r.json();
}

async function patchStatus(
  pinId: string,
  status: PinStatus,
  abortedReason?: string,
): Promise<void> {
  const body: UpdatePinInput = { status };
  if (status === 'aborted') body.abortedReason = abortedReason ?? null;
  const r = await fetch(`/api/v1/pins/${pinId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ message: 'status change fail' }));
    throw new Error(err.message ?? 'status change fail');
  }
}

async function deletePin(pinId: string): Promise<void> {
  const r = await fetch(`/api/v1/pins/${pinId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ message: 'delete fail' }));
    throw new Error(err.message ?? 'delete fail');
  }
}

export function PinDetailDrawer({ pinId, onClose }: Props) {
  const qc = useQueryClient();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deriveModalOpen, setDeriveModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['pin', pinId],
    queryFn: () => fetchPin(pinId as string),
    enabled: !!pinId,
  });

  const pin = data?.data;

  const statusMutation = useMutation({
    mutationFn: (args: { status: PinStatus; reason?: string }) =>
      patchStatus(pinId as string, args.status, args.reason),
    onSuccess: () => {
      message.success('状态已更新');
      qc.invalidateQueries({ queryKey: ['pins'] });
      qc.invalidateQueries({ queryKey: ['pin', pinId] });
    },
    onError: (err) => message.error(`状态变更失败: ${(err as Error).message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deletePin(pinId as string),
    onSuccess: () => {
      message.success('已删除');
      qc.invalidateQueries({ queryKey: ['pins'] });
      onClose();
    },
    onError: (err) => message.error(`删除失败: ${(err as Error).message}`),
  });

  const handleDelete = () => {
    Modal.confirm({
      title: '删除图钉',
      content: (
        <div>
          <Paragraph type="secondary" style={{ marginBottom: 4 }}>
            软删除:Pin 会从大盘和清单消失,关联的拜访记录保留(parentPinId 不动)。
          </Paragraph>
          <Paragraph type="warning" style={{ marginBottom: 0 }}>
            如需还原,请联系管理员(V0.7 上回收站 UI)。
          </Paragraph>
        </div>
      ),
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => deleteMutation.mutateAsync(),
    });
  };

  const handleAbort = () => {
    let reason = '';
    Modal.confirm({
      title: '中止图钉',
      content: (
        <div>
          <Paragraph type="secondary">中止后此图钉颜色变浅灰,可后续重开。</Paragraph>
          <TextArea
            rows={3}
            placeholder="中止原因(必填)"
            onChange={(e) => { reason = e.target.value; }}
          />
        </div>
      ),
      okText: '确认中止',
      cancelText: '取消',
      onOk: () => {
        if (!reason.trim()) {
          message.error('中止原因必填');
          return Promise.reject();
        }
        return statusMutation.mutateAsync({ status: 'aborted', reason });
      },
    });
  };

  return (
    <>
      <Drawer
        title={
          pin ? (
            <Space>
              <Text strong style={{ fontSize: 15 }}>{pin.title}</Text>
              <Tag color={STATUS_TAG[pin.status].color}>{STATUS_TAG[pin.status].label}</Tag>
            </Space>
          ) : '加载中…'
        }
        placement="right"
        width={440}
        open={!!pinId}
        onClose={onClose}
        destroyOnClose
      >
        {isLoading || !pin ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spin /></div>
        ) : (
          <>
            {/* 状态切换按钮组 */}
            <Space style={{ marginBottom: 16 }} wrap>
              {pin.status === 'in_progress' && (
                <>
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    loading={statusMutation.isPending}
                    onClick={() => statusMutation.mutate({ status: 'completed' })}
                  >
                    标记完成
                  </Button>
                  <Button
                    danger
                    icon={<CloseCircleOutlined />}
                    onClick={handleAbort}
                  >
                    中止
                  </Button>
                </>
              )}
              {pin.status !== 'in_progress' && (
                <Button
                  type="primary"
                  icon={<ReloadOutlined />}
                  loading={statusMutation.isPending}
                  onClick={() => statusMutation.mutate({ status: 'in_progress' })}
                >
                  重开
                </Button>
              )}
              <Button icon={<PlusOutlined />} onClick={() => setDeriveModalOpen(true)}>
                派生计划点
              </Button>
              <Button icon={<EditOutlined />} onClick={() => setEditModalOpen(true)}>
                编辑
              </Button>
              <Button
                danger
                icon={<DeleteOutlined />}
                loading={deleteMutation.isPending}
                onClick={handleDelete}
              >
                删除
              </Button>
            </Space>

            {/* 详情展示 */}
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="优先级">
                <Tag color={PRIORITY_TAG[pin.priority].color}>{PRIORITY_TAG[pin.priority].label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="城市">
                {pin.cityName}({pin.provinceCode})
              </Descriptions.Item>
              <Descriptions.Item label="描述">
                {pin.description ?? <Text type="secondary">—</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {pin.createdAt.replace('T', ' ').slice(0, 16)}
              </Descriptions.Item>
              {pin.closedAt && (
                <Descriptions.Item label="关闭时间">
                  {pin.closedAt.replace('T', ' ').slice(0, 16)}
                </Descriptions.Item>
              )}
              {pin.status === 'aborted' && pin.abortedReason && (
                <Descriptions.Item label="中止原因">
                  <Text type="secondary">{pin.abortedReason}</Text>
                </Descriptions.Item>
              )}
            </Descriptions>

            <PinCommentBoard pinId={pin.id} />
          </>
        )}
      </Drawer>

      {pin && (
        <PinFormModal
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          editing={pin}
        />
      )}

      {pin && (
        <VisitFormModal
          open={deriveModalOpen}
          onClose={() => setDeriveModalOpen(false)}
          defaultStatus="planned"
          presetParentPinId={pin.id}
          presetProvinceCode={pin.provinceCode}
          presetCityName={pin.cityName}
        />
      )}
    </>
  );
}
