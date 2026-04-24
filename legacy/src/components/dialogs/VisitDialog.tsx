import { useEffect, useMemo } from 'react';
import {
  Modal,
  Form,
  Cascader,
  Input,
  Radio,
  Select,
  Button,
  Space,
  App as AntdApp,
  Popconfirm,
  Tag,
} from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { buildCascadeOptions } from '@/utils/region';
import { findProvince, findCity, findDistrict } from '@/mock/regions';
import { useVisitStore } from '@/stores/visitStore';
import { usePolicyStore } from '@/stores/policyStore';
import { useAuthStore } from '@/stores/authStore';
import {
  VISIT_COLOR_HEX,
  VISIT_COLOR_LABEL,
  type VisitColor,
  type VisitRecord,
  type VisitStatus,
} from '@/types';

interface FormValues {
  region: string[]; // [provinceCode, cityCode, districtCode?]
  department: string;
  contactPerson?: string;
  status: VisitStatus;
  color: VisitColor;
  policyIds?: string[];
  content: string;
}

interface Props {
  open: boolean;
  editing?: VisitRecord | null;
  onClose: () => void;
}

export default function VisitDialog({ open, editing, onClose }: Props) {
  const [form] = Form.useForm<FormValues>();
  const { message } = AntdApp.useApp();
  const add = useVisitStore((s) => s.add);
  const update = useVisitStore((s) => s.update);
  const remove = useVisitStore((s) => s.remove);
  const policies = usePolicyStore((s) => s.policies);
  const user = useAuthStore((s) => s.user);
  const options = useMemo(() => buildCascadeOptions(), []);

  const status = Form.useWatch('status', form);
  const isEdit = !!editing;
  const canEdit = !isEdit || (user && editing.userId === user.id);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.setFieldsValue({
        region: [
          editing.provinceCode,
          editing.cityCode,
          ...(editing.districtCode ? [editing.districtCode] : []),
        ],
        department: editing.department,
        contactPerson: editing.contactPerson,
        status: editing.status,
        color: editing.color,
        policyIds: editing.policyIds,
        content: editing.content,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ status: 'completed', color: 'green' });
    }
  }, [open, editing, form]);

  const onStatusChange = (v: VisitStatus) => {
    if (v === 'planned') form.setFieldsValue({ color: 'blue' });
    else if (form.getFieldValue('color') === 'blue') form.setFieldsValue({ color: 'green' });
  };

  const onFinish = (values: FormValues) => {
    if (!user) return;
    const [provinceCode, cityCode, districtCode] = values.region;
    const province = findProvince(provinceCode);
    const city = findCity(provinceCode, cityCode) ?? province;
    const district = districtCode
      ? findDistrict(provinceCode, cityCode, districtCode)
      : undefined;
    if (!province || !city) {
      message.error('省市信息无效');
      return;
    }
    const base = {
      userId: user.id,
      provinceCode,
      provinceName: province.name,
      cityCode,
      cityName: city.name,
      districtCode,
      districtName: district?.name,
      department: values.department,
      contactPerson: values.contactPerson,
      status: values.status,
      color: values.color,
      policyIds: values.policyIds ?? [],
      content: values.content,
      plannedAt: values.status === 'planned' ? new Date().toISOString() : undefined,
      visitedAt: values.status === 'completed' ? new Date().toISOString() : undefined,
    };
    if (editing) {
      update(editing.id, base);
      message.success('已更新');
    } else {
      add(base);
      message.success('已创建');
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      title={isEdit ? '编辑拜访记录' : '新增拜访记录'}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      width={560}
    >
      <Form<FormValues> form={form} layout="vertical" onFinish={onFinish} disabled={!canEdit}>
        <Form.Item
          name="region"
          label="省 / 市 / 区"
          rules={[{ required: true, message: '请选择地区（至少到市）' }]}
        >
          <Cascader
            options={options}
            placeholder="选择省 / 市 / 区"
            changeOnSelect
            showSearch
          />
        </Form.Item>
        <Form.Item
          name="department"
          label="部门"
          rules={[{ required: true, message: '请输入部门（如：西湖区发改局）' }]}
        >
          <Input placeholder="如：西湖区发改局" />
        </Form.Item>
        <Form.Item name="contactPerson" label="对接人">
          <Input placeholder="选填" />
        </Form.Item>
        <Form.Item
          name="status"
          label="状态"
          rules={[{ required: true }]}
        >
          <Radio.Group onChange={(e) => onStatusChange(e.target.value)}>
            <Radio.Button value="completed">已完成</Radio.Button>
            <Radio.Button value="planned">计划（蓝点）</Radio.Button>
          </Radio.Group>
        </Form.Item>
        <Form.Item name="color" label="点颜色" rules={[{ required: true }]}>
          <Radio.Group>
            {(['green', 'yellow', 'red', 'blue'] as VisitColor[]).map((c) => (
              <Radio.Button
                key={c}
                value={c}
                disabled={status === 'planned' && c !== 'blue'}
                style={{
                  background:
                    status && form.getFieldValue('color') === c ? VISIT_COLOR_HEX[c] : undefined,
                }}
              >
                <Tag color={VISIT_COLOR_HEX[c]} style={{ margin: 0, color: '#fff' }}>
                  {VISIT_COLOR_LABEL[c]}
                </Tag>
              </Radio.Button>
            ))}
          </Radio.Group>
        </Form.Item>
        <Form.Item name="policyIds" label="关联政策">
          <Select
            mode="multiple"
            placeholder="可多选"
            options={policies.map((p) => ({ value: p.id, label: p.name }))}
            allowClear
          />
        </Form.Item>
        <Form.Item
          name="content"
          label="工作进度 / 产出"
          rules={[{ required: true, message: '请填写本次拜访的进度或产出' }]}
        >
          <Input.TextArea
            rows={3}
            placeholder="如：就某政策进行沟通，获取XX申报口径..."
            maxLength={500}
            showCount
          />
        </Form.Item>
        <Form.Item>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            {isEdit && canEdit ? (
              <Popconfirm
                title="删除这条记录？"
                onConfirm={() => {
                  remove(editing.id);
                  message.success('已删除');
                  onClose();
                }}
                okText="删除"
                cancelText="取消"
              >
                <Button danger icon={<DeleteOutlined />}>
                  删除
                </Button>
              </Popconfirm>
            ) : (
              <span />
            )}
            <Space>
              <Button onClick={onClose}>取消</Button>
              <Button type="primary" htmlType="submit" disabled={!canEdit}>
                {isEdit ? '保存' : '创建'}
              </Button>
            </Space>
          </Space>
        </Form.Item>
        {!canEdit && (
          <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: -8 }}>
            仅创建者可以编辑或删除这条记录
          </div>
        )}
      </Form>
    </Modal>
  );
}
