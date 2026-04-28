import { Form, Input, Modal, message } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { resetUserPassword, type UserListItem } from '@/api/users';

interface Props {
  open: boolean;
  user: UserListItem | null;
  onClose: () => void;
}

interface FormValues {
  newPassword: string;
  confirm: string;
}

export function ResetUserPasswordModal({ open, user, onClose }: Props) {
  const [form] = Form.useForm<FormValues>();

  const mutation = useMutation({
    mutationFn: (vs: FormValues) => resetUserPassword(user!.id, vs.newPassword),
    onSuccess: () => {
      message.success(`已重置 ${user?.username} 的密码`);
      form.resetFields();
      onClose();
    },
    onError: (e) => message.error(`失败: ${(e as Error).message}`),
  });

  if (!user) return null;

  return (
    <Modal
      open={open}
      title={`重置密码 — ${user.displayName}`}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="保存"
      cancelText="取消"
      destroyOnHidden
      confirmLoading={mutation.isPending}
    >
      <Form<FormValues> form={form} layout="vertical" onFinish={(vs) => mutation.mutate(vs)}>
        <Form.Item label="新密码" name="newPassword" rules={[{ required: true, min: 6, max: 64 }]}>
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          label="确认新密码"
          name="confirm"
          dependencies={['newPassword']}
          rules={[
            { required: true },
            ({ getFieldValue }) => ({
              validator(_, value) {
                return !value || getFieldValue('newPassword') === value
                  ? Promise.resolve()
                  : Promise.reject(new Error('两次密码不一致'));
              },
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
