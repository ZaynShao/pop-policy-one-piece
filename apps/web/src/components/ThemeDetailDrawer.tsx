import { Button, Descriptions, Drawer, Empty, Space, Spin, Table, Tag, Typography, message } from 'antd';
import { CheckCircleOutlined, CloudDownloadOutlined, InboxOutlined, ReloadOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  THEME_TEMPLATE_LABEL,
  UserRoleCode,
  type ThemeStatus,
  type ThemeRegionLevel,
} from '@pop/shared-types';
import { archiveTheme, fetchCoverage, fetchTheme, publishTheme, unarchiveTheme } from '@/api/themes';
import { useAuthStore } from '@/stores/auth';

const { Text } = Typography;

const STATUS_TAG: Record<ThemeStatus, { color: string; label: string }> = {
  draft: { color: 'default', label: '草稿' },
  published: { color: 'green', label: '已发布' },
  archived: { color: 'default', label: '已归档' },
};

const LEVEL_LABEL: Record<ThemeRegionLevel, string> = {
  province: '省级',
  city: '市级',
  district: '区级',
};

const THEME_WRITE_ALLOWED_ROLES: ReadonlySet<UserRoleCode> = new Set([
  UserRoleCode.SysAdmin,
  UserRoleCode.CentralGa,
]);

interface Props {
  themeId: string | null;
  onClose: () => void;
}

export function ThemeDetailDrawer({ themeId, onClose }: Props) {
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const canWrite = currentUser ? THEME_WRITE_ALLOWED_ROLES.has(currentUser.roleCode) : false;

  const { data, isLoading } = useQuery({
    queryKey: ['theme', themeId],
    queryFn: () => fetchTheme(themeId as string),
    enabled: !!themeId,
  });

  const theme = data?.data;

  const fetchCovMut = useMutation({
    mutationFn: () => fetchCoverage(themeId as string),
    onSuccess: () => {
      message.success('覆盖清单已更新');
      qc.invalidateQueries({ queryKey: ['theme', themeId] });
      qc.invalidateQueries({ queryKey: ['themes'] });
    },
    onError: (err) => message.error(`拉取失败: ${(err as Error).message}`),
  });

  const publishMut = useMutation({
    mutationFn: () => publishTheme(themeId as string),
    onSuccess: () => {
      message.success('已发布');
      qc.invalidateQueries({ queryKey: ['theme', themeId] });
      qc.invalidateQueries({ queryKey: ['themes'] });
    },
    onError: (err) => message.error(`发布失败: ${(err as Error).message}`),
  });

  const archiveMut = useMutation({
    mutationFn: () => archiveTheme(themeId as string),
    onSuccess: () => {
      message.success('已归档');
      qc.invalidateQueries({ queryKey: ['theme', themeId] });
      qc.invalidateQueries({ queryKey: ['themes'] });
    },
    onError: (err) => message.error(`归档失败: ${(err as Error).message}`),
  });

  const unarchiveMut = useMutation({
    mutationFn: () => unarchiveTheme(themeId as string),
    onSuccess: () => {
      message.success('已恢复');
      qc.invalidateQueries({ queryKey: ['theme', themeId] });
      qc.invalidateQueries({ queryKey: ['themes'] });
    },
    onError: (err) => message.error(`恢复失败: ${(err as Error).message}`),
  });

  return (
    <Drawer
      title={
        theme ? (
          <Space>
            <Text strong style={{ fontSize: 15 }}>{theme.title}</Text>
            <Tag color={STATUS_TAG[theme.status].color}>{STATUS_TAG[theme.status].label}</Tag>
          </Space>
        ) : '加载中…'
      }
      placement="right"
      width={520}
      open={!!themeId}
      onClose={onClose}
      destroyOnClose
    >
      {isLoading || !theme ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spin /></div>
      ) : (
        <>
          {canWrite && (
            <Space style={{ marginBottom: 16 }} wrap>
              {theme.status !== 'archived' && (
                <Button
                  icon={<CloudDownloadOutlined />}
                  loading={fetchCovMut.isPending}
                  onClick={() => fetchCovMut.mutate()}
                >
                  {theme.coverage.length > 0 ? '重新拉取覆盖' : '拉取覆盖清单'}
                </Button>
              )}
              {theme.status === 'draft' && (
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  loading={publishMut.isPending}
                  disabled={theme.coverage.length === 0}
                  onClick={() => publishMut.mutate()}
                >
                  发布
                </Button>
              )}
              {theme.status === 'published' && (
                <Button
                  danger
                  icon={<InboxOutlined />}
                  loading={archiveMut.isPending}
                  onClick={() => archiveMut.mutate()}
                >
                  归档
                </Button>
              )}
              {theme.status === 'archived' && (
                <Button
                  type="primary"
                  icon={<ReloadOutlined />}
                  loading={unarchiveMut.isPending}
                  onClick={() => unarchiveMut.mutate()}
                >
                  恢复发布
                </Button>
              )}
            </Space>
          )}

          <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label="模板">{THEME_TEMPLATE_LABEL[theme.template]}</Descriptions.Item>
            <Descriptions.Item label="关键词">
              {theme.keywords.length > 0
                ? theme.keywords.map((k) => <Tag key={k}>{k}</Tag>)
                : <Text type="secondary">—</Text>}
            </Descriptions.Item>
            <Descriptions.Item label="地域范围">
              {theme.regionScope ?? <Text type="secondary">—</Text>}
            </Descriptions.Item>
            <Descriptions.Item label="发布时间">
              {theme.publishedAt ? theme.publishedAt.replace('T', ' ').slice(0, 16) : <Text type="secondary">—</Text>}
            </Descriptions.Item>
          </Descriptions>

          <Text strong>覆盖清单 ({theme.coverage.length})</Text>
          <Table
            size="small"
            style={{ marginTop: 8 }}
            dataSource={theme.coverage}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            locale={{ emptyText: <Empty description="暂无覆盖记录,点上方「拉取覆盖清单」" /> }}
            columns={[
              { title: '区划码', dataIndex: 'regionCode' as const, width: 100 },
              {
                title: '层级',
                dataIndex: 'regionLevel' as const,
                width: 80,
                render: (l: ThemeRegionLevel) => LEVEL_LABEL[l],
              },
              {
                title: '主属性值',
                dataIndex: 'mainValue' as const,
                width: 100,
                sorter: (a, b) => a.mainValue - b.mainValue,
                defaultSortOrder: 'descend' as const,
              },
            ]}
          />
        </>
      )}
    </Drawer>
  );
}
