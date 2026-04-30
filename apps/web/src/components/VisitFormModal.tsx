import { useEffect, useMemo, useState } from 'react';
import { Form, Input, Modal, Select, DatePicker, Radio, Switch, Segmented, message, Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type {
  Visit,
  CreateVisitInput,
  UpdateVisitInput,
  CityListResponse,
  VisitStatusColor,
  GovOrg,
  GovContact,
} from '@pop/shared-types';
import { authHeaders } from '@/lib/api';
import { fetchGovOrgs, createGovOrg } from '@/api/gov-orgs';
import { fetchGovContacts } from '@/api/gov-contacts';

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
  orgId?: string;
  contactId?: string;
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

  const [orgSearch, setOrgSearch] = useState('');
  const [contactSearch, setContactSearch] = useState('');

  const watchedOrgId = Form.useWatch('orgId', form);
  const watchedProvinceCode = Form.useWatch('provinceCode', form);
  const watchedCityName = Form.useWatch('cityName', form);
  const watchedStatus = Form.useWatch('status', form) ?? 'completed';

  const { data: cityList } = useQuery({
    queryKey: ['cities'],
    queryFn: fetchCities,
    staleTime: Infinity,
  });

  // K 模块 — 机构搜索按已选省市过滤,北京时后端合并中央部委
  const { data: orgList } = useQuery({
    queryKey: ['gov-orgs', 'visit-form', watchedProvinceCode, watchedCityName, orgSearch],
    queryFn: () => fetchGovOrgs({
      provinceCode: watchedProvinceCode,
      cityName: watchedCityName,
      search: orgSearch || undefined,
      limit: 30,
    }),
    enabled: !!watchedProvinceCode && !!watchedCityName,
  });

  const { data: contactList } = useQuery({
    queryKey: ['gov-contacts', 'visit-form', watchedOrgId, contactSearch],
    queryFn: () => fetchGovContacts({
      orgId: watchedOrgId,
      search: contactSearch || undefined,
      limit: 20,
    }),
    enabled: !!watchedOrgId,
  });

  const provinceOptions = useMemo(
    () => (cityList?.data ?? []).map((p) => ({ label: p.provinceName, value: p.provinceCode })),
    [cityList],
  );

  const cityOptions = useMemo(() => {
    const p = cityList?.data.find((x) => x.provinceCode === watchedProvinceCode);
    return (p?.cities ?? []).map((c) => ({ label: c.name, value: c.name }));
  }, [cityList, watchedProvinceCode]);

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
        orgId: editing.orgId ?? undefined,
        contactId: editing.contactId ?? undefined,
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

  // K 模块 — 内联快速创建机构(不弹完整表单)
  const inlineCreateOrgMutation = useMutation({
    mutationFn: async () => {
      const provinceCode = form.getFieldValue('provinceCode');
      const cityName = form.getFieldValue('cityName');
      const name = orgSearch.trim();
      if (!provinceCode || !cityName) throw new Error('请先选择省/市');
      if (!name) throw new Error('请输入机构名');
      return createGovOrg({
        name,
        provinceCode,
        cityName,
        level: 'municipal',
        functionTags: [],
      });
    },
    onSuccess: (org) => {
      message.success(`已创建「${org.name}」`);
      qc.invalidateQueries({ queryKey: ['gov-orgs'] });
      form.setFieldsValue({ orgId: org.id });
      setOrgSearch('');
    },
    onError: (err) => {
      message.error(`新建机构失败: ${(err as Error).message}`);
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const headers = { 'Content-Type': 'application/json', ...authHeaders() };
      const isPlanned = values.status === 'planned';

      const payload: CreateVisitInput | UpdateVisitInput = {
        status: values.status,
        title: isPlanned ? values.title : undefined,
        plannedDate: isPlanned ? values.plannedDate?.format('YYYY-MM-DD') : undefined,
        visitDate: !isPlanned ? values.visitDate?.format('YYYY-MM-DD') : undefined,
        // K 模块:桌面端统一走机构库,department 不再前端发送(老数据保留)
        orgId: values.orgId ?? null,
        contactId: values.contactId ?? null,
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
      qc.invalidateQueries({ queryKey: ['gov-contacts'] });
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

        {/* K 模块 — 省/市上移,机构搜索按所选省市过滤 */}
        <Form.Item label="省" name="provinceCode" rules={[{ required: true }]}>
          <Select
            options={provinceOptions}
            disabled={!!editing || !!presetProvinceCode}
            onChange={() => {
              form.setFieldsValue({
                cityName: undefined as unknown as string,
                orgId: undefined,
                contactId: undefined,
              });
            }}
            showSearch
            optionFilterProp="label"
            placeholder="选择省级(选北京可搜中央部委)"
          />
        </Form.Item>
        <Form.Item label="市" name="cityName" rules={[{ required: true }]}>
          <Select
            options={cityOptions}
            disabled={!!editing || !!presetCityName || !watchedProvinceCode}
            onChange={() => {
              form.setFieldsValue({ orgId: undefined, contactId: undefined });
            }}
            showSearch
            optionFilterProp="label"
            placeholder="选择市级"
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

            {/* K 模块 — 老数据(无 orgId)编辑提示 */}
            {editing && !editing.orgId && editing.department && (
              <div style={{
                marginBottom: 16, padding: 8,
                background: '#e6f4ff', border: '1px solid #91caff',
                borderRadius: 6, fontSize: 13,
              }}>
                💡 原始记录:对接部门「{editing.department}」 — 请在下方选择对应机构(找不到可一键新建)
              </div>
            )}

            {/* K 模块 — 机构(GovOrg)+ 内联快速创建 */}
            <Form.Item
              label="对接机构"
              name="orgId"
              rules={[{ required: true, message: '请选择机构(找不到可一键新建)' }]}
            >
              <Select
                showSearch
                allowClear
                filterOption={false}
                onSearch={setOrgSearch}
                disabled={!watchedProvinceCode || !watchedCityName}
                placeholder={
                  !watchedProvinceCode || !watchedCityName
                    ? '先选择省/市'
                    : '搜索机构名/简称(如「长沙发改」)'
                }
                options={(orgList?.data ?? []).map((o: GovOrg) => ({
                  label: `${o.name}${o.shortName ? ` (${o.shortName})` : ''}`,
                  value: o.id,
                }))}
                notFoundContent={
                  orgSearch && watchedProvinceCode && watchedCityName ? (
                    <Button
                      size="small"
                      type="link"
                      icon={<PlusOutlined />}
                      loading={inlineCreateOrgMutation.isPending}
                      onClick={() => inlineCreateOrgMutation.mutate()}
                    >
                      + 新建「{orgSearch}」到 {watchedCityName}
                    </Button>
                  ) : null
                }
              />
            </Form.Item>

            {/* K 模块 — 联系人(GovContact)+ free text 兜底 */}
            <Form.Item label="对接人(姓名)" required>
              <Form.Item name="contactId" noStyle>
                <Select
                  showSearch
                  allowClear
                  filterOption={false}
                  onSearch={setContactSearch}
                  disabled={!watchedOrgId}
                  placeholder={watchedOrgId ? '从历史联系人挑选' : '先选机构,或下方手填新人'}
                  options={(contactList?.data ?? []).map((c: GovContact) => ({
                    label: `${c.name} · ${c.title}`,
                    value: c.id,
                  }))}
                  style={{ marginBottom: 8 }}
                />
              </Form.Item>
              <Form.Item name="contactPerson" noStyle
                rules={[{ required: true, max: 64, message: '至少手填一个名字' }]}>
                <Input maxLength={64} placeholder="姓名(必填,后端会按 (机构, 姓名) 自动建联系人)" />
              </Form.Item>
            </Form.Item>

            <Form.Item label="对接人职务" name="contactTitle">
              <Input maxLength={64} placeholder="可选,如:处长" />
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
      </Form>
    </Modal>
  );
}
