import { useEffect, useMemo } from 'react';
import { Form, Input, Modal, Select, DatePicker, Radio, Switch, Segmented, message } from 'antd';
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
  editing?: Visit;
  defaultStatus?: 'planned' | 'completed';
  presetParentPinId?: string;
  presetProvinceCode?: string;
  presetCityName?: string;
}

interface FormValues {
  status: 'planned' | 'completed';
  title?: string;
  plannedDate?: dayjs.Dayjs;
  visitDate?: dayjs.Dayjs;
  provinceCode: string;
  cityName: string;
  department?: string;
  contactPerson?: string;
  contactTitle?: string;
  outcomeSummary?: string;
  color?: VisitStatusColor;
  followUp: boolean;
}

async function fetchCities(): Promise<CityListResponse> {
  const r = await fetch('/api/v1/cities', { headers: authHeaders() });
  if (!r.ok) throw new Error('cities fetch fail');
  return r.json();
}

export function VisitFormModal({
  open,
  onClose,
  editing,
  defaultStatus,
  presetParentPinId,
  presetProvinceCode,
  presetCityName,
}: Props) {
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
  const watchedStatus = Form.useWatch('status', form) ?? 'completed';

  const cityOptions = useMemo(() => {
    const p = cityList?.data.find((x) => x.provinceCode === selectedProvince);
    return (p?.cities ?? []).map((c) => ({ label: c.name, value: c.name }));
  }, [cityList, selectedProvince]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.setFieldsValue({
        status: editing.status === 'cancelled' ? 'planned' : editing.status,
        title: editing.title ?? undefined,
        plannedDate: editing.plannedDate ? dayjs(editing.plannedDate) : undefined,
        visitDate: editing.visitDate ? dayjs(editing.visitDate) : undefined,
        provinceCode: editing.provinceCode,
        cityName: editing.cityName,
        department: editing.department ?? undefined,
        contactPerson: editing.contactPerson ?? undefined,
        contactTitle: editing.contactTitle ?? '',
        outcomeSummary: editing.outcomeSummary ?? undefined,
        color: editing.color === 'blue' ? undefined : editing.color ?? undefined,
        followUp: editing.followUp,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        status: defaultStatus ?? 'completed',
        provinceCode: presetProvinceCode,
        cityName: presetCityName,
        visitDate: dayjs(),
        color: 'green',
        followUp: false,
      });
    }
  }, [open, editing, defaultStatus, presetProvinceCode, presetCityName, form]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const headers = { 'Content-Type': 'application/json', ...authHeaders() };
      const isPlanned = values.status === 'planned';

      const payload: CreateVisitInput | UpdateVisitInput = {
        status: values.status,
        title: isPlanned ? values.title : undefined,
        plannedDate: isPlanned ? values.plannedDate?.format('YYYY-MM-DD') : undefined,
        visitDate: !isPlanned ? values.visitDate?.format('YYYY-MM-DD') : undefined,
        department: !isPlanned ? values.department : undefined,
        contactPerson: !isPlanned ? values.contactPerson : undefined,
        contactTitle: !isPlanned ? values.contactTitle || undefined : undefined,
        outcomeSummary: !isPlanned ? values.outcomeSummary : undefined,
        color: !isPlanned ? values.color : undefined,
        followUp: !isPlanned ? values.followUp : undefined,
        ...(presetParentPinId && !editing ? { parentPinId: presetParentPinId } : {}),
      };

      if (editing) {
        const r = await fetch(`/api/v1/visits/${editing.id}`, {
          method: 'PUT', headers, body: JSON.stringify(payload),
        });
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.message ?? 'update fail');
        }
      } else {
        const createBody: CreateVisitInput = {
          ...payload,
          provinceCode: values.provinceCode,
          cityName: values.cityName,
        } as CreateVisitInput;
        const r = await fetch(`/api/v1/visits`, {
          method: 'POST', headers, body: JSON.stringify(createBody),
        });
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.message ?? 'create fail');
        }
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
      title={editing ? '编辑拜访' : '新建计划/拜访'}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="保存"
      cancelText="取消"
      confirmLoading={mutation.isPending}
      width={560}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={(v) => mutation.mutate(v)}>
        <Form.Item label="类型" name="status" rules={[{ required: true }]}>
          <Segmented
            options={[
              { label: '○ 计划中', value: 'planned' },
              { label: '● 已拜访', value: 'completed' },
            ]}
            block
            disabled={!!editing}
          />
        </Form.Item>

        {watchedStatus === 'planned' && (
          <>
            <Form.Item label="标题" name="title" rules={[{ required: true, max: 100 }]}>
              <Input maxLength={100} placeholder="比如:拜访中芯成都厂" />
            </Form.Item>
            <Form.Item label="计划日期" name="plannedDate">
              <DatePicker style={{ width: '100%' }} placeholder="可选,如:2026-05-15" />
            </Form.Item>
          </>
        )}

        {watchedStatus === 'completed' && (
          <>
            <Form.Item label="拜访日期" name="visitDate" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} />
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
          </>
        )}

        <Form.Item label="省" name="provinceCode" rules={[{ required: true }]}>
          <Select
            options={provinceOptions}
            disabled={!!editing || !!presetProvinceCode}
            onChange={() => form.setFieldsValue({ cityName: undefined as unknown as string })}
            showSearch
            optionFilterProp="label"
            placeholder="选择省级"
          />
        </Form.Item>
        <Form.Item label="市" name="cityName" rules={[{ required: true }]}>
          <Select
            options={cityOptions}
            disabled={!!editing || !!presetCityName || !selectedProvince}
            showSearch
            optionFilterProp="label"
            placeholder="选择市级"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
