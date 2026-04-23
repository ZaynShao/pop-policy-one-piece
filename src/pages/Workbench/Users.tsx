import { Avatar, Card, Table, Tag, Typography } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/stores/authStore';
import { ROLE_LABEL } from '@/types';

const { Title, Text } = Typography;

export default function Users() {
  const users = useAuthStore((s) => s.users);
  return (
    <div style={{ padding: 24, height: '100%', overflowY: 'auto' }}>
      <Title level={4} style={{ marginTop: 0 }}>
        成员
      </Title>
      <Text type="secondary">（演示原型：角色与权限为 mock，二期接入真实账号体系）</Text>
      <Card style={{ marginTop: 16 }} styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          pagination={false}
          dataSource={users}
          columns={[
            {
              title: '成员',
              key: 'member',
              render: (_, u) => (
                <Avatar.Group size="default">
                  <Avatar icon={<UserOutlined />} />
                  <span style={{ marginLeft: 8 }}>{u.nickname}</span>
                </Avatar.Group>
              ),
            },
            { title: '用户名', dataIndex: 'username' },
            { title: '邮箱', dataIndex: 'email' },
            {
              title: '角色',
              dataIndex: 'role',
              render: (r: string) => <Tag>{ROLE_LABEL[r as keyof typeof ROLE_LABEL]}</Tag>,
            },
          ]}
        />
      </Card>
    </div>
  );
}
