import { useEffect, useMemo } from 'react';
import { Modal, Form, Cascader, Input, Button, Space, App as AntdApp } from 'antd';
import { buildCascadeOptions } from '@/utils/region';
import { findProvince, findCity } from '@/mock/regions';
import { usePinStore } from '@/stores/pinStore';
import { useAuthStore } from '@/stores/authStore';

interface FormValues {
  region: string[]; // [provinceCode, cityCode]
  title: string;
  goal: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function PinDialog({ open, onClose }: Props) {
  const [form] = Form.useForm<FormValues>();
  const { message } = AntdApp.useApp();
  const add = usePinStore((s) => s.add);
  const user = useAuthStore((s) => s.user);
  const options = useMemo(() => buildCascadeOptions(), []);

  useEffect(() => {
    if (open) form.resetFields();
  }, [open, form]);

  const onFinish = (values: FormValues) => {
    if (!user) return;
    const [provinceCode, cityCode] = values.region;
    const province = findProvince(provinceCode);
    const city = findCity(provinceCode, cityCode) ?? province;
    if (!province || !city) {
      message.error('省市信息无效');
      return;
    }
    add({
      creatorId: user.id,
      creatorName: user.nickname,
      provinceCode,
      provinceName: province.name,
      cityCode,
      cityName: city.name,
      title: values.title,
      goal: values.goal,
    });
    message.success('图钉已创建');
    onClose();
  };

  return (
    <Modal
      open={open}
      title="📌 新建重点项目图钉"
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      width={520}
    >
      <Form<FormValues> form={form} layout="vertical" onFinish={onFinish}>
        <Form.Item
          name="region"
          label="城市"
          rules={[{ required: true, message: '请选择省 / 市' }]}
        >
          <Cascader
            options={options.map((p) => ({ ...p, children: p.children?.map(({ children: _d, ...c }) => c) }))}
            placeholder="选择省 / 市"
            changeOnSelect
            showSearch
          />
        </Form.Item>
        <Form.Item
          name="title"
          label="项目标题"
          rules={[{ required: true, message: '请输入项目标题' }]}
        >
          <Input placeholder="如：深圳 V2G 示范项目对接" />
        </Form.Item>
        <Form.Item
          name="goal"
          label="工作目标"
          rules={[{ required: true, message: '请描述工作目标' }]}
        >
          <Input.TextArea
            rows={3}
            placeholder="如：月内完成深圳南山 V2G 示范项目政府侧对接"
            maxLength={300}
            showCount
          />
        </Form.Item>
        <Form.Item>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={onClose}>取消</Button>
            <Button type="primary" htmlType="submit">
              创建图钉
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}
