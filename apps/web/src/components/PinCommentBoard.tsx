import { useState } from 'react';
import { Avatar, Button, Empty, Input, List, Space, Tag, Typography, message } from 'antd';
import { RobotOutlined, UserOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPinComments, postPinComment } from '@/api/comments';

const { TextArea } = Input;
const { Text } = Typography;

interface Props {
  pinId: string;
}

export function PinCommentBoard({ pinId }: Props) {
  const qc = useQueryClient();
  const [body, setBody] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['pin-comments', pinId],
    queryFn: () => fetchPinComments(pinId),
    enabled: !!pinId,
  });

  const mutation = useMutation({
    mutationFn: (input: { body: string }) => postPinComment(pinId, input),
    onSuccess: () => {
      setBody('');
      qc.invalidateQueries({ queryKey: ['pin-comments', pinId] });
      message.success('已发送');
    },
    onError: (err) => message.error(`发送失败: ${(err as Error).message}`),
  });

  const comments = data?.data ?? [];

  return (
    <div style={{ marginTop: 16 }}>
      <Text strong>留言板 ({comments.length})</Text>
      <List
        loading={isLoading}
        locale={{ emptyText: <Empty description="暂无留言" /> }}
        dataSource={comments}
        renderItem={(c) => (
          <List.Item>
            <List.Item.Meta
              avatar={
                <Avatar
                  size="small"
                  icon={c.sourceType === 'auto_from_visit' ? <RobotOutlined /> : <UserOutlined />}
                />
              }
              title={
                <Space size={6}>
                  <Text style={{ fontSize: 12 }}>{c.createdBy ?? 'system'}</Text>
                  {c.sourceType === 'auto_from_visit' && <Tag color="cyan">系统</Tag>}
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {c.createdAt.replace('T', ' ').slice(0, 16)}
                  </Text>
                </Space>
              }
              description={<Text style={{ fontSize: 13 }}>{c.body}</Text>}
            />
          </List.Item>
        )}
      />
      <Space.Compact style={{ width: '100%', marginTop: 8 }}>
        <TextArea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="输入留言…"
        />
        <Button
          type="primary"
          loading={mutation.isPending}
          disabled={!body.trim()}
          onClick={() => mutation.mutate({ body: body.trim() })}
        >
          发送
        </Button>
      </Space.Compact>
    </div>
  );
}
