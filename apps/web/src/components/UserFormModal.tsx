import { useEffect } from 'react';
import { Form, Input, Modal, Select, message } from 'antd';
import { useMutation } from '@tanstack/react-query';
import type { CreateUserInput, UserRoleCode } from '@pop/shared-types';
import { createUser, updateUserById, type UserListItem } from '@/api/users';

const ROLE_OPTIONS = [
  { label: '系统管理员', value: 'sys_admin' },
  { label: '负责人', value: 'lead' },
  { label: 'PMO', value: 'pmo' },
  { label: '属地 GA', value: 'local_ga' },
  { label: '中台 GA', value: 'central_ga' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  /** 编辑模式传 user;新建模式传 null/undefined */
  editing?: UserListItem | null;
  onSaved: () => void;
}

interface FormValues {
  username: string;
  displayName: string;
  email: string;
  password: string;
  roleCode: UserRoleCode;
}

export function UserFormModal({ open, onClose, editing, onSaved }: Props) {
  const [form] = Form.useForm<FormValues>();

  useEffect(() => {
    if (open) {
      form.resetFields();
      if (editing) {
        form.setFieldsValue({
          username: editing.username,
          displayName: editing.displayName,
          // 编辑模式不预填邮箱(显示空,留空表示不改)
        });
      }
    }
  }, [open, editing, form]);

  const mutation = useMutation({
    mutationFn: (vs: FormValues) =>
      editing
        ? updateUserById(editing.id, {
            displayName: vs.displayName,
            email: vs.email || undefined,
          })
        : createUser(vs as CreateUserInput),
    onSuccess: () => {
      message.success(editing ? '已保存' : '已创建');
      onSaved();
      onClose();
    },
    onError: (e) => message.error(`失败: ${(e as Error).message}`),
  });

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={editing ? `编辑用户 — ${editing.username}` : '新建用户'}
      onOk={() => form.submit()}
      okText="保存"
      cancelText="取消"
      destroyOnHidden
      confirmLoading={mutation.isPending}
    >
      <Form<FormValues> form={form} layout="vertical" onFinish={(vs) => mutation.mutate(vs)}>
        <Form.Item label="用户名" name="username" rules={[{ required: !editing, max: 32 }]}>
          <Input disabled={!!editing} />
        </Form.Item>
        <Form.Item label="显示名称" name="displayName" rules={[{ required: true, max: 32 }]}>
          <Input maxLength={32} />
        </Form.Item>
        <Form.Item
          label="邮箱"
          name="email"
          rules={[{ required: !editing, type: 'email', max: 128 }]}
        >
          <Input placeholder={editing ? '留空不修改' : ''} />
        </Form.Item>
        {!editing && (
          <Form.Item label="初始密码" name="password" rules={[{ required: true, min: 6, max: 64 }]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        )}
        {!editing && (
          <Form.Item label="角色" name="roleCode" rules={[{ required: true }]} initialValue="local_ga">
            <Select options={ROLE_OPTIONS} />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}
