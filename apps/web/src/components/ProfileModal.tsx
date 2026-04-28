import { useEffect } from 'react';
import { Button, Form, Input, Modal, Tabs, message } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { changePassword, updateProfile } from '@/api/users';
import { useAuthStore } from '@/stores/auth';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface ProfileForm {
  displayName: string;
}

interface PasswordForm {
  oldPassword: string;
  newPassword: string;
  confirm: string;
}

/**
 * 头像下拉「修改资料」Modal — 2 tab:基本信息 / 修改密码
 */
export function ProfileModal({ open, onClose }: Props) {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [profileForm] = Form.useForm<ProfileForm>();
  const [passwordForm] = Form.useForm<PasswordForm>();

  // open 时 reset + 注入当前 displayName
  useEffect(() => {
    if (open && user) {
      profileForm.setFieldsValue({ displayName: user.displayName });
      passwordForm.resetFields();
    }
  }, [open, user, profileForm, passwordForm]);

  const profileMutation = useMutation({
    mutationFn: (vs: ProfileForm) => updateProfile(vs.displayName),
    onSuccess: (data) => {
      message.success('资料已更新');
      updateUser({ displayName: data.displayName });
      onClose();
    },
    onError: (e) => message.error(`保存失败: ${(e as Error).message}`),
  });

  const passwordMutation = useMutation({
    mutationFn: (vs: PasswordForm) => changePassword(vs.oldPassword, vs.newPassword),
    onSuccess: () => {
      message.success('密码已修改');
      passwordForm.resetFields();
      onClose();
    },
    onError: (e) => message.error(`修改失败: ${(e as Error).message}`),
  });

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="修改资料"
      footer={null}
      destroyOnHidden
      width={420}
    >
      <Tabs
        items={[
          {
            key: 'profile',
            label: '基本信息',
            children: (
              <Form<ProfileForm>
                form={profileForm}
                layout="vertical"
                onFinish={(vs) => profileMutation.mutate(vs)}
              >
                <Form.Item label="用户名">
                  <Input value={user?.username ?? ''} disabled />
                </Form.Item>
                <Form.Item
                  label="显示名称"
                  name="displayName"
                  rules={[{ required: true, message: '请输入显示名称' }, { max: 32 }]}
                >
                  <Input maxLength={32} />
                </Form.Item>
                <Form.Item style={{ marginBottom: 0 }}>
                  <Button
                    type="primary"
                    htmlType="submit"
                    block
                    loading={profileMutation.isPending}
                  >
                    保存
                  </Button>
                </Form.Item>
              </Form>
            ),
          },
          {
            key: 'password',
            label: '修改密码',
            children: (
              <Form<PasswordForm>
                form={passwordForm}
                layout="vertical"
                onFinish={(vs) => passwordMutation.mutate(vs)}
              >
                <Form.Item
                  label="旧密码"
                  name="oldPassword"
                  rules={[{ required: true }, { min: 6, message: '至少 6 位' }]}
                >
                  <Input.Password autoComplete="current-password" />
                </Form.Item>
                <Form.Item
                  label="新密码"
                  name="newPassword"
                  rules={[{ required: true }, { min: 6, message: '至少 6 位' }, { max: 64 }]}
                >
                  <Input.Password autoComplete="new-password" />
                </Form.Item>
                <Form.Item
                  label="确认新密码"
                  name="confirm"
                  dependencies={['newPassword']}
                  rules={[
                    { required: true, message: '请再次输入新密码' },
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
                <Form.Item style={{ marginBottom: 0 }}>
                  <Button
                    type="primary"
                    htmlType="submit"
                    block
                    loading={passwordMutation.isPending}
                  >
                    保存
                  </Button>
                </Form.Item>
              </Form>
            ),
          },
        ]}
      />
    </Modal>
  );
}
