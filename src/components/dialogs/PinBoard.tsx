import { useState } from 'react';
import {
  Modal,
  List,
  Input,
  Button,
  Space,
  Tag,
  Dropdown,
  Popconfirm,
  Typography,
  App as AntdApp,
} from 'antd';
import { DeleteOutlined, EllipsisOutlined } from '@ant-design/icons';
import { usePinStore } from '@/stores/pinStore';
import { useAuthStore } from '@/stores/authStore';
import { PIN_STATUS_LABEL, type Pin, type PinStatus } from '@/types';
import dayjs from 'dayjs';

const { Text } = Typography;

const STATUS_COLOR: Record<PinStatus, string> = {
  active: 'orange',
  done: 'green',
  cancelled: 'default',
};

interface Props {
  open: boolean;
  pin: Pin | null;
  onClose: () => void;
}

export default function PinBoard({ open, pin, onClose }: Props) {
  const { message, modal } = AntdApp.useApp();
  const user = useAuthStore((s) => s.user);
  const addComment = usePinStore((s) => s.addComment);
  const removeComment = usePinStore((s) => s.removeComment);
  const setStatus = usePinStore((s) => s.setStatus);
  const removePin = usePinStore((s) => s.remove);
  const [text, setText] = useState('');

  if (!pin) return null;

  const canManage = user && (user.role === 'pmo' || user.role === 'lead');
  const isCreator = user && user.id === pin.creatorId;

  const submit = () => {
    if (!text.trim() || !user) return;
    addComment(pin.id, {
      userId: user.id,
      nickname: user.nickname,
      content: text.trim(),
    });
    setText('');
  };

  const onStatusChange = (status: PinStatus) => {
    if (status === 'cancelled') {
      modal.confirm({
        title: '中止此图钉？',
        content: '确认该项目与负责人沟通后中止？',
        onOk: () => {
          setStatus(pin.id, 'cancelled');
          message.success('已中止');
        },
      });
    } else {
      setStatus(pin.id, status);
      message.success('状态已更新');
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={600}
      title={
        <Space>
          <span style={{ fontSize: 18 }}>📌</span>
          <Text strong>{pin.title}</Text>
          <Tag color={STATUS_COLOR[pin.status]}>{PIN_STATUS_LABEL[pin.status]}</Tag>
        </Space>
      }
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <div>
          <Text type="secondary">{pin.provinceName} · {pin.cityName}</Text>
          <span style={{ margin: '0 8px', color: '#ccc' }}>|</span>
          <Text type="secondary">创建人：{pin.creatorName}</Text>
          <span style={{ margin: '0 8px', color: '#ccc' }}>|</span>
          <Text type="secondary">{dayjs(pin.createdAt).format('YYYY-MM-DD')}</Text>
          {canManage && (
            <Dropdown
              menu={{
                items: [
                  { key: 'active', label: '进行中', onClick: () => onStatusChange('active') },
                  { key: 'done', label: '标记已完成', onClick: () => onStatusChange('done') },
                  { key: 'cancelled', label: '中止', onClick: () => onStatusChange('cancelled') },
                  { type: 'divider' },
                  {
                    key: 'del',
                    label: '删除此图钉',
                    danger: true,
                    onClick: () => {
                      modal.confirm({
                        title: '删除此图钉？',
                        onOk: () => {
                          removePin(pin.id);
                          onClose();
                        },
                      });
                    },
                  },
                ],
              }}
            >
              <Button type="text" size="small" icon={<EllipsisOutlined />} style={{ marginLeft: 8 }} />
            </Dropdown>
          )}
        </div>
        <div
          style={{
            background: '#fafafa',
            padding: 12,
            borderRadius: 6,
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          <Text strong>工作目标：</Text>
          {pin.goal}
        </div>

        <div>
          <Text strong>留言板（{pin.comments.length}）</Text>
          <List
            style={{ marginTop: 8, maxHeight: 240, overflowY: 'auto' }}
            dataSource={pin.comments}
            locale={{ emptyText: '暂无留言，快来记录一下进展吧～' }}
            renderItem={(c) => {
              const canDelete = canManage || (user && user.id === c.userId);
              return (
                <List.Item
                  actions={
                    canDelete
                      ? [
                          <Popconfirm
                            key="del"
                            title="删除这条留言？"
                            onConfirm={() => removeComment(pin.id, c.id)}
                          >
                            <Button type="text" size="small" icon={<DeleteOutlined />} />
                          </Popconfirm>,
                        ]
                      : []
                  }
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <Text strong style={{ fontSize: 13 }}>{c.nickname}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {dayjs(c.createdAt).format('MM-DD HH:mm')}
                        </Text>
                      </Space>
                    }
                    description={<div style={{ color: '#333' }}>{c.content}</div>}
                  />
                </List.Item>
              );
            }}
          />
        </div>

        {pin.status === 'active' && user && (
          <Space.Compact style={{ width: '100%' }}>
            <Input.TextArea
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`以 ${user.nickname} 身份留言…`}
              maxLength={200}
            />
            <Button type="primary" onClick={submit} disabled={!text.trim()}>
              发送
            </Button>
          </Space.Compact>
        )}
        {isCreator && null /* 创建者如果是属地 GA 也可以留言，上面已包含 */}
      </Space>
    </Modal>
  );
}
