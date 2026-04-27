import { useEffect } from 'react';
import {
  Button, DatePicker, Divider, Drawer, Form, Input,
  Radio, Space, Spin, Switch, Tag, Typography, message,
} from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { Visit, UpdateVisitInput } from '@pop/shared-types';
import { authHeaders } from '@/lib/api';
import { palette } from '@/tokens';

const { Text } = Typography;
const { TextArea } = Input;

const COLOR_TAG: Record<Visit['color'], { color: string; label: string }> = {
  green: { color: 'green', label: '常规' },
  yellow: { color: 'gold', label: '层级提升' },
  red: { color: 'orange', label: '紧急' },
};

const DEMO_TOOLS = [
  { name: '主线政策汇编.txt', file: '/demo/policy-sample.txt' },
  { name: '谈参参考.txt', file: '/demo/briefing-sample.txt' },
  { name: '地方数据整合.txt', file: '/demo/data-sample.txt' },
];

interface Props {
  visitId: string | null;
  onClose: () => void;
}

interface FormValues {
  visitDate: dayjs.Dayjs;
  department: string;
  contactPerson: string;
  contactTitle: string;
  outcomeSummary: string;
  color: Visit['color'];
  followUp: boolean;
}

async function fetchVisit(id: string): Promise<{ data: Visit }> {
  const r = await fetch(`/api/v1/visits/${id}`, { headers: authHeaders() });
  if (!r.ok) throw new Error('visit detail fetch fail');
  return r.json();
}

export function VisitDetailDrawer({ visitId, onClose }: Props) {
  const [form] = Form.useForm<FormValues>();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['visit', visitId],
    queryFn: () => fetchVisit(visitId as string),
    enabled: !!visitId,
  });

  const visit = data?.data;

  useEffect(() => {
    if (visit) {
      form.setFieldsValue({
        visitDate: dayjs(visit.visitDate),
        department: visit.department,
        contactPerson: visit.contactPerson,
        contactTitle: visit.contactTitle ?? '',
        outcomeSummary: visit.outcomeSummary,
        color: visit.color,
        followUp: visit.followUp,
      });
    }
  }, [visit, form]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const body: UpdateVisitInput = {
        visitDate: values.visitDate.format('YYYY-MM-DD'),
        department: values.department,
        contactPerson: values.contactPerson,
        contactTitle: values.contactTitle || null,
        outcomeSummary: values.outcomeSummary,
        color: values.color,
        followUp: values.followUp,
      };
      const r = await fetch(`/api/v1/visits/${visitId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error('save fail');
    },
    onSuccess: () => {
      message.success('已保存');
      qc.invalidateQueries({ queryKey: ['visits'] });
      qc.invalidateQueries({ queryKey: ['visit', visitId] });
      onClose();
    },
    onError: (err) => message.error(`保存失败: ${(err as Error).message}`),
  });

  return (
    <Drawer
      title={
        visit ? (
          <Space>
            <span>{visit.visitDate}</span>
            <Tag color={COLOR_TAG[visit.color].color}>{COLOR_TAG[visit.color].label}</Tag>
            <Text type="secondary" style={{ fontSize: 13 }}>{visit.cityName}</Text>
          </Space>
        ) : '加载中…'
      }
      placement="right"
      width={420}
      open={!!visitId}
      onClose={onClose}
      destroyOnClose
      footer={
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" loading={mutation.isPending} onClick={() => form.submit()}>
            保存
          </Button>
        </Space>
      }
    >
      {isLoading || !visit ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spin /></div>
      ) : (
        <>
          <Form form={form} layout="vertical" onFinish={(v) => mutation.mutate(v)}>
            <Form.Item label="拜访日期" name="visitDate" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="对接部门" name="department" rules={[{ required: true }]}>
              <Input maxLength={128} />
            </Form.Item>
            <Form.Item label="对接人" name="contactPerson" rules={[{ required: true }]}>
              <Input maxLength={64} />
            </Form.Item>
            <Form.Item label="对接人职务" name="contactTitle">
              <Input maxLength={64} />
            </Form.Item>
            <Form.Item label="产出描述" name="outcomeSummary" rules={[{ required: true }]}>
              <TextArea rows={3} />
            </Form.Item>
            <Form.Item label="颜色" name="color" rules={[{ required: true }]}>
              <Radio.Group>
                <Radio value="green">绿</Radio>
                <Radio value="yellow">黄</Radio>
                <Radio value="red">红</Radio>
              </Radio.Group>
            </Form.Item>
            <Form.Item label="后续跟进" name="followUp" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Form>

          <Divider style={{ margin: '12px 0' }} />

          <div>
            <Text strong style={{ color: palette.primary, fontSize: 13 }}>相关工具</Text>
            <Space direction="vertical" size={8} style={{ width: '100%', marginTop: 8 }}>
              {DEMO_TOOLS.map((t) => (
                <a key={t.file} href={t.file} download>
                  <Button block icon={<DownloadOutlined />} style={{ textAlign: 'left' }}>
                    {t.name}
                  </Button>
                </a>
              ))}
            </Space>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 8 }}>
              占位文档,演示用 · B15 工具级联留 V0.7
            </Text>
          </div>
        </>
      )}
    </Drawer>
  );
}
