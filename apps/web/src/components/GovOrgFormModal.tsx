import { useEffect } from 'react';
import { Form, Input, Modal, Select, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GovOrg, GovOrgLevel, CityListResponse } from '@pop/shared-types';
import { authHeaders } from '@/lib/api';
import { createGovOrg, updateGovOrg } from '@/api/gov-orgs';

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: GovOrg;
  /** 现场新增模式 — 创建成功后回调,不仅 invalidate */
  onCreated?: (org: GovOrg) => void;
  /** 预填省市(VisitFormModal 现场新建用) */
  presetProvinceCode?: string;
  presetCityName?: string;
}

interface FormValues {
  name: string;
  shortName?: string;
  provinceCode: string;
  cityName: string;
  districtName?: string;
  level: GovOrgLevel;
  address?: string;
}

async function fetchCities(): Promise<CityListResponse> {
  const r = await fetch('/api/v1/cities', { headers: authHeaders() });
  if (!r.ok) throw new Error('cities fetch fail');
  return r.json();
}

export function GovOrgFormModal({ open, onClose, editing, onCreated, presetProvinceCode, presetCityName }: Props) {
  const [form] = Form.useForm<FormValues>();
  const qc = useQueryClient();

  const { data: cityList } = useQuery({
    queryKey: ['cities'],
    queryFn: fetchCities,
    staleTime: Infinity,
  });

  const provinceOptions = (cityList?.data ?? []).map((p) => ({
    label: p.provinceName, value: p.provinceCode,
  }));

  const selectedProvince = Form.useWatch('provinceCode', form);
  const cityOptions = (() => {
    const p = cityList?.data.find((x) => x.provinceCode === selectedProvince);
    return (p?.cities ?? []).map((c) => ({ label: c.name, value: c.name }));
  })();

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.setFieldsValue({
        name: editing.name,
        shortName: editing.shortName ?? undefined,
        provinceCode: editing.provinceCode,
        cityName: editing.cityName,
        districtName: editing.districtName ?? undefined,
        level: editing.level,
        address: editing.address ?? undefined,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        provinceCode: presetProvinceCode,
        cityName: presetCityName,
        level: 'municipal',
      });
    }
  }, [open, editing, presetProvinceCode, presetCityName, form]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (editing) {
        return updateGovOrg(editing.id, {
          name: values.name,
          shortName: values.shortName ?? null,
          districtName: values.districtName ?? null,
          level: values.level,
          address: values.address ?? null,
        });
      }
      return createGovOrg({
        name: values.name,
        shortName: values.shortName,
        provinceCode: values.provinceCode,
        cityName: values.cityName,
        districtName: values.districtName,
        level: values.level,
        address: values.address,
      });
    },
    onSuccess: (org) => {
      message.success(editing ? '已保存' : '已创建机构');
      qc.invalidateQueries({ queryKey: ['gov-orgs'] });
      if (onCreated) onCreated(org);
      onClose();
    },
    onError: (err) => message.error(`保存失败: ${(err as Error).message}`),
  });

  return (
    <Modal
      open={open}
      title={editing ? '编辑机构' : '新建机构'}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="保存"
      cancelText="取消"
      confirmLoading={mutation.isPending}
      width={520}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={(v) => mutation.mutate(v)}>
        <Form.Item label="全称" name="name" rules={[{ required: true, max: 80 }]}>
          <Input maxLength={80} placeholder="如:长沙市发展和改革委员会" />
        </Form.Item>
        <Form.Item label="简称" name="shortName" rules={[{ max: 30 }]}>
          <Input maxLength={30} placeholder="如:长沙发改委" />
        </Form.Item>
        <Form.Item label="省" name="provinceCode" rules={[{ required: true }]}>
          <Select
            options={provinceOptions}
            disabled={!!editing || !!presetProvinceCode}
            showSearch optionFilterProp="label"
            placeholder="选择省级"
            onChange={() => form.setFieldsValue({ cityName: undefined as unknown as string })}
          />
        </Form.Item>
        <Form.Item label="市" name="cityName" rules={[{ required: true }]}>
          <Select
            options={cityOptions}
            disabled={!!editing || !!presetCityName || !selectedProvince}
            showSearch optionFilterProp="label"
            placeholder="选择市级"
          />
        </Form.Item>
        <Form.Item label="区/县" name="districtName">
          <Input maxLength={50} placeholder="可选,如:浦东新区" />
        </Form.Item>
        <Form.Item label="层级" name="level" rules={[{ required: true }]}>
          <Select options={[
            { label: '中央', value: 'national' },
            { label: '省级', value: 'provincial' },
            { label: '市级', value: 'municipal' },
            { label: '区/县级', value: 'district' },
          ]} />
        </Form.Item>
        <Form.Item label="地址" name="address">
          <Input.TextArea rows={2} maxLength={200} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
