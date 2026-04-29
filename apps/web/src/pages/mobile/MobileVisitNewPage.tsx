import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Button,
  DatePicker,
  Form,
  Input,
  Radio,
  Select,
  Space,
  Switch,
  Typography,
  message,
} from 'antd';
import { EnvironmentOutlined, LogoutOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { CreateVisitInput, CityListResponse } from '@pop/shared-types';
import { authHeaders } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { palette } from '@/tokens';

const { Title, Text } = Typography;

interface FormValues {
  visitDate: Dayjs;
  provinceCode: string;
  cityName: string;
  department: string;
  contactPerson: string;
  contactTitle?: string;
  outcomeSummary: string;
  color: 'red' | 'yellow' | 'green';
  followUp: boolean;
}

async function fetchCities(): Promise<CityListResponse> {
  const r = await fetch('/api/v1/cities', { headers: authHeaders() });
  if (!r.ok) throw new Error('cities fetch fail');
  return r.json();
}

async function postVisit(input: CreateVisitInput): Promise<void> {
  const r = await fetch('/api/v1/visits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message ?? 'visit 创建失败');
  }
}

/**
 * 移动端 — 已拜访录入(R2.6: GPS 临时禁用,改为手选省市)
 *
 * UX:
 * - 单列大字体表单(touch target ≥44px)
 * - 顶部 GPS 按钮灰显 disabled,下方提示
 * - 省/市两个 Select(联动),复用桌面端 fetchCities 模式
 * - 提交后跳 /m/done(可"再录一笔")
 */
export function MobileVisitNewPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [form] = Form.useForm<FormValues>();

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

  const submitMutation = useMutation({
    mutationFn: async (vs: FormValues) => {
      const input: CreateVisitInput = {
        status: 'completed',
        visitDate: vs.visitDate.format('YYYY-MM-DD'),
        department: vs.department,
        contactPerson: vs.contactPerson,
        contactTitle: vs.contactTitle || undefined,
        outcomeSummary: vs.outcomeSummary,
        color: vs.color,
        followUp: vs.followUp,
        provinceCode: vs.provinceCode,
        cityName: vs.cityName,
      };
      await postVisit(input);
    },
    onSuccess: () => {
      message.success('已录入');
      navigate('/m/done');
    },
    onError: (e) => message.error(`提交失败: ${(e as Error).message}`),
  });

  return (
    <div
      style={{
        minHeight: '100vh',
        background: palette.bgBase,
        padding: '12px 16px 32px',
      }}
    >
      {/* 极简顶栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Space size={6}>
          <span style={{ fontSize: 18 }}>📍</span>
          <Text strong style={{ fontSize: 14, color: palette.primary }}>POP · 移动录入</Text>
        </Space>
        <Space size={4}>
          <Text type="secondary" style={{ fontSize: 11 }}>{user?.displayName ?? ''}</Text>
          <Button
            type="text"
            size="small"
            icon={<LogoutOutlined />}
            onClick={() => { logout(); navigate('/login'); }}
            aria-label="登出"
            style={{ color: palette.textMuted }}
          />
        </Space>
      </div>

      <Title level={4} style={{ color: palette.primary, marginTop: 0, marginBottom: 16, fontSize: 20 }}>
        新建拜访
      </Title>

      {/* GPS 按钮 — R2.6 暂时禁用,以后恢复 */}
      <div style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          size="large"
          block
          icon={<EnvironmentOutlined />}
          disabled
          style={{ height: 56, fontSize: 16 }}
        >
          一键定位(GPS)
        </Button>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', textAlign: 'center', marginTop: 6 }}>
          GPS 暂未启用,请下方手选省市
        </Text>
      </div>

      {/* 表单 */}
      <Form<FormValues>
        form={form}
        layout="vertical"
        size="large"
        initialValues={{
          visitDate: dayjs(),
          followUp: false,
          color: 'green',
        }}
        onFinish={(vs) => submitMutation.mutate(vs)}
        disabled={submitMutation.isPending}
      >
        <Form.Item label="拜访日期" name="visitDate" rules={[{ required: true }]}>
          <DatePicker style={{ width: '100%' }} inputReadOnly />
        </Form.Item>
        <Form.Item label="省" name="provinceCode" rules={[{ required: true }]}>
          <Select
            options={provinceOptions}
            onChange={() => form.setFieldsValue({ cityName: undefined as unknown as string })}
            showSearch
            optionFilterProp="label"
            placeholder="选择省级"
          />
        </Form.Item>
        <Form.Item label="市" name="cityName" rules={[{ required: true }]}>
          <Select
            options={cityOptions}
            disabled={!selectedProvince}
            showSearch
            optionFilterProp="label"
            placeholder={selectedProvince ? '选择市级' : '请先选省'}
          />
        </Form.Item>
        <Form.Item label="对接部门" name="department" rules={[{ required: true, max: 128 }]}>
          <Input placeholder="例:上海市发改委" maxLength={128} />
        </Form.Item>
        <Form.Item label="对接人" name="contactPerson" rules={[{ required: true, max: 64 }]}>
          <Input placeholder="例:张处长" maxLength={64} />
        </Form.Item>
        <Form.Item label="对接人职务(可选)" name="contactTitle" rules={[{ max: 64 }]}>
          <Input placeholder="例:综合处处长" maxLength={64} />
        </Form.Item>
        <Form.Item label="产出描述" name="outcomeSummary" rules={[{ required: true }]}>
          <Input.TextArea rows={4} placeholder="一句话总结这次拜访的产出" maxLength={500} showCount />
        </Form.Item>
        <Form.Item label="颜色" name="color" rules={[{ required: true }]}>
          <Radio.Group buttonStyle="solid" style={{ width: '100%', display: 'flex' }}>
            <Radio.Button value="green" style={{ flex: 1, textAlign: 'center', height: 44, lineHeight: '40px' }}>
              🟢 常规
            </Radio.Button>
            <Radio.Button value="yellow" style={{ flex: 1, textAlign: 'center', height: 44, lineHeight: '40px' }}>
              🟡 层级提升
            </Radio.Button>
            <Radio.Button value="red" style={{ flex: 1, textAlign: 'center', height: 44, lineHeight: '40px' }}>
              🔴 紧急
            </Radio.Button>
          </Radio.Group>
        </Form.Item>
        <Form.Item label="是否需要后续跟进" name="followUp" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Button
          type="primary"
          htmlType="submit"
          block
          size="large"
          loading={submitMutation.isPending}
          style={{ height: 56, fontSize: 16, marginTop: 8 }}
        >
          提交
        </Button>
      </Form>

      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <Link to="/" style={{ fontSize: 12, color: palette.textMuted }}>
          回桌面端 →
        </Link>
      </div>
    </div>
  );
}
