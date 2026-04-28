import { Form, Modal, Select, message } from 'antd';
import { useMutation } from '@tanstack/react-query';
import type { UserRoleCode } from '@pop/shared-types';
import { changeUserRole, type UserListItem } from '@/api/users';

const ROLE_OPTIONS = [
  { label: '系统管理员', value: 'sys_admin' },
  { label: '负责人', value: 'lead' },
  { label: 'PMO', value: 'pmo' },
  { label: '属地 GA', value: 'local_ga' },
  { label: '中台 GA', value: 'central_ga' },
];

interface Props {
  open: boolean;
  user: UserListItem | null;
  onClose: () => void;
  onSaved: () => void;
}

interface FormValues {
  roleCode: UserRoleCode;
}

export function ChangeRoleModal({ open, user, onClose, onSaved }: Props) {
  const [form] = Form.useForm<FormValues>();

  const mutation = useMutation({
    mutationFn: (vs: FormValues) => changeUserRole(user!.id, vs.roleCode),
    onSuccess: () => {
      message.success('角色已更新');
      onSaved();
      onClose();
    },
    onError: (e) => message.error(`失败: ${(e as Error).message}`),
  });

  if (!user) return null;

  return (
    <Modal
      open={open}
      title={`改角色 — ${user.displayName}`}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="保存"
      cancelText="取消"
      destroyOnHidden
      confirmLoading={mutation.isPending}
    >
      <Form<FormValues>
        form={form}
        layout="vertical"
        initialValues={{ roleCode: user.roleCode ?? 'local_ga' }}
        onFinish={(vs) => mutation.mutate(vs)}
      >
        <Form.Item label="新角色" name="roleCode" rules={[{ required: true }]}>
          <Select options={ROLE_OPTIONS} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
