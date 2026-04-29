import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  DatePicker,
  Form,
  Input,
  Radio,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
  message,
} from 'antd';
import { EnvironmentOutlined, LogoutOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useMutation } from '@tanstack/react-query';
import type { CreateVisitInput, VisitStatusColor } from '@pop/shared-types';
import { fetchReverseGeocode } from '@/api/regions';
import { authHeaders } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { palette } from '@/tokens';

const { Title, Text } = Typography;

interface FormValues {
  visitDate: Dayjs;
  department: string;
  contactPerson: string;
  contactTitle?: string;
  outcomeSummary: string;
  color: 'red' | 'yellow' | 'green';
  followUp: boolean;
}

interface LocationState {
  lng: number;
  lat: number;
  provinceCode: string;
  provinceName: string;
  cityName: string;
  accuracy: number;
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
 * 移动端 — 已拜访录入(用户拍 Q1=A / Q2=B / Q3=B / Q4=A / Q5=a)
 *
 * UX:
 * - 单列大字体表单(touch target ≥44px)
 * - 顶部 GPS 一键定位按钮 → 反查 city → prefill 显示
 * - 提交后跳 /m/done(可"再录一笔")
 */
export function MobileVisitNewPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [form] = Form.useForm<FormValues>();
  const [location, setLocation] = useState<LocationState | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const handleGps = () => {
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsError('当前浏览器不支持 GPS 定位');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { longitude: lng, latitude: lat, accuracy } = pos.coords;
          const data = await fetchReverseGeocode(lng, lat);
          setLocation({
            lng,
            lat,
            provinceCode: data.provinceCode,
            provinceName: data.provinceName,
            cityName: data.cityName,
            accuracy,
          });
        } catch (e) {
          setGpsError((e as Error).message);
        } finally {
          setGpsLoading(false);
        }
      },
      (err) => {
        setGpsLoading(false);
        // PERMISSION_DENIED=1, POSITION_UNAVAILABLE=2, TIMEOUT=3
        if (err.code === 1) setGpsError('GPS 权限被拒绝,请在浏览器设置允许位置');
        else if (err.code === 2) setGpsError('当前位置不可用(信号差?)');
        else if (err.code === 3) setGpsError('GPS 超时,请重试');
        else setGpsError('GPS 失败:' + err.message);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  };

  const submitMutation = useMutation({
    mutationFn: async (vs: FormValues) => {
      if (!location) throw new Error('请先一键定位');
      const input: CreateVisitInput = {
        status: 'completed',
        visitDate: vs.visitDate.format('YYYY-MM-DD'),
        department: vs.department,
        contactPerson: vs.contactPerson,
        contactTitle: vs.contactTitle || undefined,
        outcomeSummary: vs.outcomeSummary,
        color: vs.color,
        followUp: vs.followUp,
        provinceCode: location.provinceCode,
        cityName: location.cityName,
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

      {/* GPS 一键定位 */}
      <div style={{ marginBottom: 16 }}>
        {!location && !gpsLoading && !gpsError && (
          <Button
            type="primary"
            size="large"
            block
            icon={<EnvironmentOutlined />}
            onClick={handleGps}
            style={{ height: 56, fontSize: 16 }}
          >
            一键定位(GPS)
          </Button>
        )}
        {gpsLoading && (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <Spin /> <Text style={{ marginLeft: 8 }}>定位中…</Text>
          </div>
        )}
        {gpsError && (
          <Alert
            type="error"
            message={gpsError}
            showIcon
            action={
              <Button size="small" icon={<ReloadOutlined />} onClick={handleGps}>
                重试
              </Button>
            }
          />
        )}
        {location && (
          <Alert
            type="success"
            message={
              <Space size={8} wrap>
                <Tag color="blue" style={{ margin: 0 }}>📍 {location.provinceName}</Tag>
                <Tag color="cyan" style={{ margin: 0 }}>{location.cityName}</Tag>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  ±{Math.round(location.accuracy)}m
                </Text>
              </Space>
            }
            showIcon
            action={
              <Button size="small" icon={<ReloadOutlined />} onClick={handleGps}>
                重定位
              </Button>
            }
          />
        )}
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
        disabled={submitMutation.isPending || !location}
      >
        <Form.Item label="拜访日期" name="visitDate" rules={[{ required: true }]}>
          <DatePicker style={{ width: '100%' }} inputReadOnly />
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
          disabled={!location}
          style={{ height: 56, fontSize: 16, marginTop: 8 }}
        >
          提交
        </Button>
        {!location && (
          <Text type="secondary" style={{ fontSize: 12, display: 'block', textAlign: 'center', marginTop: 6 }}>
            请先一键定位
          </Text>
        )}
      </Form>

      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <Link to="/" style={{ fontSize: 12, color: palette.textMuted }}>
          回桌面端 →
        </Link>
      </div>
    </div>
  );
}
