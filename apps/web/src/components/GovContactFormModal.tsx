import { useEffect, useState } from 'react';
import { Form, Input, Modal, Select, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GovContact, ContactTier } from '@pop/shared-types';
import { createGovContact, updateGovContact } from '@/api/gov-contacts';
import { fetchGovOrgs } from '@/api/gov-orgs';

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: GovContact;
  /** 预填 orgId — 从 org Drawer「新建联系人」入口调用时 */
  presetOrgId?: string;
}

interface FormValues {
  name: string;
  gender?: string;
  orgId: string;
  title: string;
  tier: ContactTier;
  phone?: string;
  wechat?: string;
  preferenceNotes?: string;
}

export function GovContactFormModal({ open, onClose, editing, presetOrgId }: Props) {
  const [form] = Form.useForm<FormValues>();
  const qc = useQueryClient();
  const [orgSearch, setOrgSearch] = useState('');

  const { data: orgList } = useQuery({
    queryKey: ['gov-orgs', { search: orgSearch }],
    queryFn: () => fetchGovOrgs({ search: orgSearch || undefined, limit: 30 }),
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.setFieldsValue({
        name: editing.name,
        gender: editing.gender ?? undefined,
        orgId: editing.orgId,
        title: editing.title,
        tier: editing.tier,
        phone: editing.phone ?? undefined,
        wechat: editing.wechat ?? undefined,
        preferenceNotes: editing.preferenceNotes ?? undefined,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        orgId: presetOrgId,
        tier: 'normal',
      });
    }
  }, [open, editing, presetOrgId, form]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (editing) {
        return updateGovContact(editing.id, {
          name: values.name,
          gender: values.gender ?? null,
          title: values.title,
          tier: values.tier,
          phone: values.phone ?? null,
          wechat: values.wechat ?? null,
          preferenceNotes: values.preferenceNotes ?? null,
        });
      }
      return createGovContact({
        name: values.name,
        gender: values.gender,
        orgId: values.orgId,
        title: values.title,
        tier: values.tier,
        phone: values.phone,
        wechat: values.wechat,
        preferenceNotes: values.preferenceNotes,
      });
    },
    onSuccess: () => {
      message.success(editing ? '已保存' : '已创建联系人');
      qc.invalidateQueries({ queryKey: ['gov-contacts'] });
      onClose();
    },
    onError: (err) => message.error(`保存失败: ${(err as Error).message}`),
  });

  return (
    <Modal
      open={open}
      title={editing ? '编辑联系人' : '新建联系人'}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="保存" cancelText="取消"
      confirmLoading={mutation.isPending}
      width={520} destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={(v) => mutation.mutate(v)}>
        <Form.Item label="姓名" name="name" rules={[{ required: true, max: 50 }]}>
          <Input maxLength={50} />
        </Form.Item>
        <Form.Item label="性别" name="gender">
          <Select allowClear options={[{ label: '男', value: '男' }, { label: '女', value: '女' }]} />
        </Form.Item>
        <Form.Item label="所属机构" name="orgId" rules={[{ required: true }]}>
          <Select
            disabled={!!editing || !!presetOrgId}
            showSearch
            filterOption={false}
            onSearch={setOrgSearch}
            placeholder="搜机构名"
            options={(orgList?.data ?? []).map((o) => ({
              label: `${o.name}${o.shortName ? ` (${o.shortName})` : ''}`,
              value: o.id,
            }))}
          />
        </Form.Item>
        <Form.Item label="职务" name="title" rules={[{ required: true, max: 50 }]}>
          <Input maxLength={50} placeholder="如:处长" />
        </Form.Item>
        <Form.Item label="重要程度" name="tier" rules={[{ required: true }]}>
          <Select options={[
            { label: '核心', value: 'core' },
            { label: '重要', value: 'important' },
            { label: '常规', value: 'normal' },
          ]} />
        </Form.Item>
        <Form.Item label="电话" name="phone">
          <Input maxLength={30} />
        </Form.Item>
        <Form.Item label="微信" name="wechat">
          <Input maxLength={50} />
        </Form.Item>
        <Form.Item label="偏好备注" name="preferenceNotes">
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
