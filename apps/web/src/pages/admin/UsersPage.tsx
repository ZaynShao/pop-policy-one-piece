import { useState } from 'react';
import { Button, Modal, Space, Table, Tag, Typography, message } from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  KeyOutlined,
  PlusOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UserRoleCode } from '@pop/shared-types';
import { UserFormModal } from '@/components/UserFormModal';
import { ResetUserPasswordModal } from '@/components/ResetUserPasswordModal';
import { ChangeRoleModal } from '@/components/ChangeRoleModal';
import { deleteUser, fetchUsers, type UserListItem } from '@/api/users';

const { Title } = Typography;

const ROLE_LABEL: Record<string, string> = {
  sys_admin: '系统管理员',
  lead: '负责人',
  pmo: 'PMO',
  local_ga: '属地 GA',
  central_ga: '中台 GA',
};

const ROLE_COLOR: Record<string, string> = {
  sys_admin: 'magenta',
  lead: 'gold',
  pmo: 'blue',
  local_ga: 'green',
  central_ga: 'cyan',
};

export function UsersPage() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UserListItem | null>(null);
  const [resetting, setResetting] = useState<UserListItem | null>(null);
  const [changingRole, setChangingRole] = useState<UserListItem | null>(null);

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: () => fetchUsers(),
  });

  const data = usersQuery.data?.data ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      message.success('已删除');
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (e) => message.error(`删除失败: ${(e as Error).message}`),
  });

  const handleDelete = (u: UserListItem) => {
    Modal.confirm({
      title: `删除用户 ${u.displayName}?`,
      content: '软删除,可在数据库还原(回收站 UI 待 follow-up)。',
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => deleteMutation.mutateAsync(u.id),
    });
  };

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          用户管理 ({data.length})
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          新建用户
        </Button>
      </Space>

      <Table<UserListItem>
        dataSource={data}
        rowKey="id"
        loading={usersQuery.isLoading}
        pagination={{ pageSize: 20 }}
        columns={[
          { title: '用户名', dataIndex: 'username', width: 120 },
          { title: '显示名', dataIndex: 'displayName', width: 140 },
          {
            title: '角色',
            dataIndex: 'roleCode',
            width: 120,
            render: (r: UserRoleCode | null) =>
              r ? <Tag color={ROLE_COLOR[r]}>{ROLE_LABEL[r]}</Tag> : <Tag>无</Tag>,
          },
          {
            title: '操作',
            width: 320,
            render: (_, u: UserListItem) => (
              <Space size={4} wrap>
                <Button
                  size="small"
                  type="link"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setEditing(u);
                    setFormOpen(true);
                  }}
                >
                  编辑
                </Button>
                <Button
                  size="small"
                  type="link"
                  icon={<TeamOutlined />}
                  onClick={() => setChangingRole(u)}
                >
                  改角色
                </Button>
                <Button
                  size="small"
                  type="link"
                  icon={<KeyOutlined />}
                  onClick={() => setResetting(u)}
                >
                  重置密码
                </Button>
                <Button
                  size="small"
                  type="link"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(u)}
                >
                  删除
                </Button>
              </Space>
            ),
          },
        ]}
      />

      <UserFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editing={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ['users'] })}
      />
      <ResetUserPasswordModal
        open={!!resetting}
        user={resetting}
        onClose={() => setResetting(null)}
      />
      <ChangeRoleModal
        open={!!changingRole}
        user={changingRole}
        onClose={() => setChangingRole(null)}
        onSaved={() => qc.invalidateQueries({ queryKey: ['users'] })}
      />
    </div>
  );
}
