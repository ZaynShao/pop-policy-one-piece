import { useEffect, useMemo } from 'react';
import { Alert, Form, Input, Modal, Radio, Select, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Pin,
  CreatePinInput,
  UpdatePinInput,
  PinStatus,
  PinPriority,
  CityListResponse,
} from '@pop/shared-types';
import { authHeaders } from '@/lib/api';

const { TextArea } = Input;

interface Props {
  open: boolean;
  onClose: () => void;
  /** 编辑场景:传入现有 Pin;录入场景:undefined */
  editing?: Pin;
}

interface FormValues {
  title: string;
  description: string;
  priority: PinPriority;
  provinceCode: string;
  cityName: string;
  // 编辑态额外:
  status?: PinStatus;
  abortedReason?: string;
}

async function fetchCities(): Promise<CityListResponse> {
  const r = await fetch('/api/v1/cities', { headers: authHeaders() });
  if (!r.ok) throw new Error('cities fetch fail');
  return r.json();
}

export function PinFormModal({ open, onClose, editing }: Props) {
  const [form] = Form.useForm<FormValues>();
  const qc = useQueryClient();

  const { data: cityList } = useQuery({
    queryKey: ['cities'],
    queryFn: fetchCities,
    staleTime: Infinity,
  });

  const provinceOptions = useMemo(
    () => (cityList?.data ?? []).map((p) => ({
      label: p.provinceName, value: p.provinceCode,
    })),
    [cityList],
  );

  const selectedProvince = Form.useWatch('provinceCode', form);
  const watchStatus = Form.useWatch('status', form);
  const cityOptions = useMemo(() => {
    const p = cityList?.data.find((x) => x.provinceCode === selectedProvince);
    return (p?.cities ?? []).map((c) => ({ label: c.name, value: c.name }));
  }, [cityList, selectedProvince]);

  useEffect(() => {
    if (open && editing) {
      form.setFieldsValue({
        title: editing.title,
        description: editing.description ?? '',
        priority: editing.priority,
        provinceCode: editing.provinceCode,
        cityName: editing.cityName,
        status: editing.status,
        abortedReason: editing.abortedReason ?? '',
      });
    } else if (open) {
      form.resetFields();
      form.setFieldsValue({
        priority: 'medium',
      });
    }
  }, [open, editing, form]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const headers = { 'Content-Type': 'application/json', ...authHeaders() };
      if (editing) {
        const body: UpdatePinInput = {
          title: values.title,
          description: values.description || null,
          priority: values.priority,
          status: values.status,
          abortedReason: values.status === 'aborted'
            ? (values.abortedReason ?? null)
            : null,
        };
        const r = await fetch(`/api/v1/pins/${editing.id}`, {
          method: 'PUT', headers, body: JSON.stringify(body),
        });
        if (!r.ok) {
          const err = await r.json().catch(() => ({ message: 'update fail' }));
          throw new Error(err.message ?? 'update fail');
        }
      } else {
        const body: CreatePinInput = {
          title: values.title,
          description: values.description || undefined,
          priority: values.priority,
          provinceCode: values.provinceCode,
          cityName: values.cityName,
        };
        const r = await fetch(`/api/v1/pins`, {
          method: 'POST', headers, body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error('create fail');
      }
    },
    onSuccess: () => {
      message.success(editing ? '已保存' : '已创建');
      qc.invalidateQueries({ queryKey: ['pins'] });
      if (editing) qc.invalidateQueries({ queryKey: ['pin', editing.id] });
      onClose();
    },
    onError: (err) => {
      message.error(`保存失败: ${(err as Error).message}`);
    },
  });

  return (
    <Modal
      open={open}
      title={editing ? '编辑图钉' : '新建图钉'}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="保存"
      cancelText="取消"
      confirmLoading={mutation.isPending}
      width={560}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={(v) => mutation.mutate(v)}>
        <Form.Item label="标题" name="title" rules={[{ required: true, max: 100 }]}>
          <Input maxLength={100} placeholder="例:成都新能源汽车产业链对接" />
        </Form.Item>

        <Form.Item label="描述" name="description">
          <TextArea rows={3} placeholder="可选:项目背景 / 推进要点" />
        </Form.Item>

        <Form.Item label="优先级" name="priority" rules={[{ required: true }]}>
          <Radio.Group>
            <Radio value="high">高</Radio>
            <Radio value="medium">中</Radio>
            <Radio value="low">低</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item label="省" name="provinceCode" rules={[{ required: true }]}>
          <Select
            options={provinceOptions}
            disabled={!!editing}
            onChange={() => form.setFieldsValue({ cityName: undefined as unknown as string })}
            showSearch
            optionFilterProp="label"
            placeholder="选择省级"
          />
        </Form.Item>

        <Form.Item label="市" name="cityName" rules={[{ required: true }]}>
          <Select
            options={cityOptions}
            disabled={!!editing || !selectedProvince}
            showSearch
            optionFilterProp="label"
            placeholder="选择市级"
          />
        </Form.Item>

        {/* 编辑态:状态切换 + 中止原因 */}
        {editing && (
          <>
            <Form.Item label="状态" name="status" rules={[{ required: true }]}>
              <Radio.Group>
                <Radio value="in_progress">进行中</Radio>
                <Radio value="completed">完成</Radio>
                <Radio value="aborted">中止</Radio>
              </Radio.Group>
            </Form.Item>

            {watchStatus === 'aborted' && (
              <Form.Item
                label="中止原因"
                name="abortedReason"
                rules={[{ required: true, message: '中止时必须填写原因' }]}
              >
                <TextArea rows={2} placeholder="例:政策窗口关闭,等下一轮" />
              </Form.Item>
            )}

            {watchStatus === 'in_progress' && editing.status !== 'in_progress' && (
              <Alert
                type="info"
                showIcon
                message="重开 Pin 会清空关闭信息(closed_at / closed_by / aborted_reason)"
                style={{ marginBottom: 16 }}
              />
            )}
          </>
        )}
      </Form>
    </Modal>
  );
}
