import { useEffect, useMemo } from 'react';
import { Form, Input, Modal, Select, DatePicker, Radio, Switch, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type {
  Visit,
  CreateVisitInput,
  UpdateVisitInput,
  CityListResponse,
  VisitStatusColor,
} from '@pop/shared-types';
import { authHeaders } from '@/lib/api';

const { TextArea } = Input;

interface Props {
  open: boolean;
  onClose: () => void;
  /** 编辑场景:传入现有 Visit;录入场景:undefined */
  editing?: Visit;
}

interface FormValues {
  visitDate: dayjs.Dayjs;
  provinceCode: string;
  cityName: string;
  department: string;
  contactPerson: string;
  contactTitle: string;
  outcomeSummary: string;
  color: VisitStatusColor;
  followUp: boolean;
}

async function fetchCities(): Promise<CityListResponse> {
  const r = await fetch('/api/v1/cities', { headers: authHeaders() });
  if (!r.ok) throw new Error('cities fetch fail');
  return r.json();
}

export function VisitFormModal({ open, onClose, editing }: Props) {
  const [form] = Form.useForm<FormValues>();
  const qc = useQueryClient();

  const { data: cityList } = useQuery({
    queryKey: ['cities'],
    queryFn: fetchCities,
    staleTime: Infinity,
  });

  const provinceOptions = useMemo(
    () => (cityList?.data ?? []).map((p) => ({ label: p.provinceName, value: p.provinceCode })),
    [cityList],
  );

  const selectedProvince = Form.useWatch('provinceCode', form);
  const cityOptions = useMemo(() => {
    const p = cityList?.data.find((x) => x.provinceCode === selectedProvince);
    return (p?.cities ?? []).map((c) => ({ label: c.name, value: c.name }));
  }, [cityList, selectedProvince]);

  useEffect(() => {
    if (open && editing) {
      form.setFieldsValue({
        visitDate: dayjs(editing.visitDate),
        provinceCode: editing.provinceCode,
        cityName: editing.cityName,
        department: editing.department,
        contactPerson: editing.contactPerson,
        contactTitle: editing.contactTitle ?? '',
        outcomeSummary: editing.outcomeSummary,
        color: editing.color,
        followUp: editing.followUp,
      });
    } else if (open) {
      form.resetFields();
      form.setFieldsValue({
        visitDate: dayjs(),
        color: 'green',
        followUp: false,
      });
    }
  }, [open, editing, form]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const headers = { 'Content-Type': 'application/json', ...authHeaders() };
      if (editing) {
        const body: UpdateVisitInput = {
          visitDate: values.visitDate.format('YYYY-MM-DD'),
          department: values.department,
          contactPerson: values.contactPerson,
          contactTitle: values.contactTitle || null,
          outcomeSummary: values.outcomeSummary,
          color: values.color,
          followUp: values.followUp,
        };
        const r = await fetch(`/api/v1/visits/${editing.id}`, {
          method: 'PUT', headers, body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error('update fail');
      } else {
        const body: CreateVisitInput = {
          visitDate: values.visitDate.format('YYYY-MM-DD'),
          department: values.department,
          contactPerson: values.contactPerson,
          contactTitle: values.contactTitle || undefined,
          outcomeSummary: values.outcomeSummary,
          color: values.color,
          followUp: values.followUp,
          provinceCode: values.provinceCode,
          cityName: values.cityName,
        };
        const r = await fetch(`/api/v1/visits`, {
          method: 'POST', headers, body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error('create fail');
      }
    },
    onSuccess: () => {
      message.success(editing ? '已保存' : '已创建');
      qc.invalidateQueries({ queryKey: ['visits'] });
      onClose();
    },
    onError: (err) => {
      message.error(`保存失败: ${(err as Error).message}`);
    },
  });

  return (
    <Modal
      open={open}
      title={editing ? '编辑拜访' : '新建拜访'}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="保存"
      cancelText="取消"
      confirmLoading={mutation.isPending}
      width={560}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={(v) => mutation.mutate(v)}>
        <Form.Item label="拜访日期" name="visitDate" rules={[{ required: true }]}>
          <DatePicker style={{ width: '100%' }} />
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

        <Form.Item label="对接部门" name="department" rules={[{ required: true, max: 128 }]}>
          <Input maxLength={128} />
        </Form.Item>

        <Form.Item label="对接人" name="contactPerson" rules={[{ required: true, max: 64 }]}>
          <Input maxLength={64} />
        </Form.Item>

        <Form.Item label="对接人职务" name="contactTitle">
          <Input maxLength={64} placeholder="可选" />
        </Form.Item>

        <Form.Item label="产出描述" name="outcomeSummary" rules={[{ required: true }]}>
          <TextArea rows={3} />
        </Form.Item>

        <Form.Item label="颜色" name="color" rules={[{ required: true }]}>
          <Radio.Group>
            <Radio value="green">绿(常规)</Radio>
            <Radio value="yellow">黄(层级提升)</Radio>
            <Radio value="red">红(紧急)</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item label="后续跟进" name="followUp" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
}
