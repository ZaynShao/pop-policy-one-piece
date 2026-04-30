import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Alert,
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
import type {
  CreateVisitInput,
  CityListResponse,
  VoiceParsedFields,
  VoiceParseVisitContext,
} from '@pop/shared-types';
import { authHeaders } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { palette } from '@/tokens';
import { VoiceRecorderButton } from '@/components/VoiceRecorderButton';
import { fetchGovOrg } from '@/api/gov-orgs';

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

const REQUIRED_FOR_SUBMIT: (keyof FormValues)[] = [
  'provinceCode',
  'cityName',
  'department',
  'contactPerson',
  'outcomeSummary',
];

const FIELD_LABEL_ZH: Record<string, string> = {
  provinceCode: '省',
  cityName: '市',
  department: '对接部门',
  contactPerson: '对接人',
  outcomeSummary: '产出描述',
};

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
 * 移动端 — 已拜访录入(GPS 反查省市 + 省市下拉 + 语音录入 + LLM 自动填表)
 */
export function MobileVisitNewPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [form] = Form.useForm<FormValues>();
  const [missingAfterVoice, setMissingAfterVoice] = useState<string[]>([]);
  const [voiceHasRun, setVoiceHasRun] = useState(false);
  const [matchedOrgId, setMatchedOrgId] = useState<string | null>(null);
  const [matchedOrgName, setMatchedOrgName] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsHint, setGpsHint] = useState<string | null>(null);

  // 一键 GPS 定位 — 拿 lng/lat 后调后端 /regions/reverse 反查省市,直接 setFieldsValue
  const handleGpsLocate = () => {
    if (!navigator.geolocation) {
      setGpsHint('当前浏览器不支持 GPS');
      return;
    }
    setGpsLoading(true);
    setGpsHint(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { longitude, latitude } = pos.coords;
          const r = await fetch(
            `/api/v1/regions/reverse?lng=${longitude}&lat=${latitude}`,
            { headers: authHeaders() },
          );
          if (!r.ok) throw new Error(`reverse-geocode HTTP ${r.status}`);
          const j = await r.json();
          const { provinceCode, provinceName, cityName } = j.data ?? {};
          if (!provinceCode || !cityName) throw new Error('未匹配到省市');
          form.setFieldsValue({ provinceCode, cityName });
          setGpsHint(`✓ 已定位到 ${provinceName} / ${cityName}`);
          message.success(`已定位:${provinceName} / ${cityName}`);
        } catch (e) {
          setGpsHint(`定位失败:${(e as Error).message},请下方手选省市`);
          message.error('GPS 反查失败,请手选');
        } finally {
          setGpsLoading(false);
        }
      },
      (err) => {
        setGpsLoading(false);
        const msg =
          err.code === err.PERMISSION_DENIED
            ? 'GPS 权限被拒绝,请下方手选省市'
            : err.code === err.POSITION_UNAVAILABLE
              ? 'GPS 信号不可用,请下方手选省市'
              : err.code === err.TIMEOUT
                ? 'GPS 超时,请下方手选省市'
                : `GPS 失败:${err.message}`;
        setGpsHint(msg);
        message.warning(msg);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    );
  };

  const { data: cityList } = useQuery({
    queryKey: ['cities'],
    queryFn: fetchCities,
    staleTime: Infinity,
  });

  const provinceOptions = useMemo(
    () =>
      (cityList?.data ?? []).map((p) => ({
        label: p.provinceName,
        value: p.provinceCode,
      })),
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
        orgId: matchedOrgId,  // K 模块 — 移动端只能从语音 fuzzy match 拿,不主动选
      };
      await postVisit(input);
    },
    onSuccess: () => {
      message.success('已录入');
      navigate('/m/done');
    },
    onError: (e) => message.error(`提交失败: ${(e as Error).message}`),
  });

  // —— 语音解析回调 ——

  const getVoiceContext = (): VoiceParseVisitContext => ({
    today: dayjs().format('YYYY-MM-DD'),
    currentProvinceCode: form.getFieldValue('provinceCode') || null,
    currentCityName: form.getFieldValue('cityName') || null,
  });

  const handleVoiceParsed = (parsed: VoiceParsedFields, transcript: string) => {
    // 转 dayjs 后,filter 掉 null/undefined,setFieldsValue 字段级覆盖
    const next: Partial<FormValues> = {};
    if (parsed.visitDate) next.visitDate = dayjs(parsed.visitDate);
    if (parsed.provinceCode) next.provinceCode = parsed.provinceCode;
    if (parsed.cityName) next.cityName = parsed.cityName;
    if (parsed.department) next.department = parsed.department;
    if (parsed.contactPerson) next.contactPerson = parsed.contactPerson;
    if (parsed.contactTitle) next.contactTitle = parsed.contactTitle;
    if (parsed.outcomeSummary) next.outcomeSummary = parsed.outcomeSummary;
    if (parsed.color) next.color = parsed.color;
    if (parsed.followUp !== null) next.followUp = parsed.followUp;

    form.setFieldsValue(next);

    // K 模块 — 后端返回了 orgId 表示 fuzzy match 成功
    if (parsed.orgId) {
      const orgIdAtCallTime = parsed.orgId;
      setMatchedOrgId(orgIdAtCallTime);
      setMatchedOrgName(null);  // 清旧名,避免 voice2 短暂闪烁 voice1 的名字
      // 异步查机构名 — 用 closure 内 ID 校对当前 state,过期 fetch 不写
      fetchGovOrg(orgIdAtCallTime)
        .then((org) => {
          setMatchedOrgId((cur) => {
            if (cur === orgIdAtCallTime) {
              setMatchedOrgName(`${org.shortName ?? org.name}`);
            }
            return cur;
          });
        })
        .catch(() => {
          setMatchedOrgId((cur) => {
            if (cur === orgIdAtCallTime) {
              setMatchedOrgName(null);
            }
            return cur;
          });
        });
    } else {
      setMatchedOrgId(null);
      setMatchedOrgName(null);
    }

    // 检查必填字段缺失
    const after = { ...form.getFieldsValue(), ...next };
    const missingKeys = REQUIRED_FOR_SUBMIT.filter((k) => {
      const v = after[k];
      return v === undefined || v === null || v === '';
    });
    const missingLabels = missingKeys.map((k) => FIELD_LABEL_ZH[k] ?? k);

    setMissingAfterVoice(missingLabels);
    setVoiceHasRun(true);
    message.success(`语音已识别(${transcript.length} 字)`);

    // 有缺失字段时,自动滚动到第一个缺失字段(等 React 渲染完横幅再滚)
    if (missingKeys.length > 0) {
      const firstMissing = missingKeys[0];
      setTimeout(() => {
        form.scrollToField(firstMissing, {
          behavior: 'smooth',
          block: 'center',
        });
      }, 150);
    }
  };

  // 用户改字段时,重新计算 missing(消失或新增)
  const handleValuesChange = (
    changed: Partial<FormValues>,
    all: Partial<FormValues>,
  ) => {
    if (!voiceHasRun) return;
    // K 模块 — 用户改 department → 清 matchedOrgId(避免 orgId 指向旧机构)
    if (changed.department !== undefined) {
      setMatchedOrgId(null);
      setMatchedOrgName(null);
    }
    const stillMissing = REQUIRED_FOR_SUBMIT.filter((k) => {
      const v = all[k];
      return v === undefined || v === null || v === '';
    }).map((k) => FIELD_LABEL_ZH[k] ?? k);
    setMissingAfterVoice(stillMissing);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: palette.bgBase,
        padding: '12px 16px 32px',
      }}
    >
      {/* 极简顶栏 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <Space size={6}>
          <span style={{ fontSize: 18 }}>📍</span>
          <Text strong style={{ fontSize: 14, color: palette.primary }}>
            POP · 移动录入
          </Text>
        </Space>
        <Space size={4}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {user?.displayName ?? ''}
          </Text>
          <Button
            type="text"
            size="small"
            icon={<LogoutOutlined />}
            onClick={() => {
              logout();
              navigate('/login');
            }}
            aria-label="登出"
            style={{ color: palette.textMuted }}
          />
        </Space>
      </div>

      <Title
        level={4}
        style={{
          color: palette.primary,
          marginTop: 0,
          marginBottom: 16,
          fontSize: 20,
        }}
      >
        新建拜访
      </Title>

      {/* R2.7 — 语音录入按钮(最前面 + 鲜艳红) */}
      <div style={{ marginBottom: 12 }}>
        <VoiceRecorderButton
          onParsed={handleVoiceParsed}
          getContext={getVoiceContext}
          disabled={submitMutation.isPending}
        />
      </div>

      {/* 必填字段缺失横幅 */}
      {missingAfterVoice.length > 0 && (
        <Alert
          type="warning"
          showIcon
          closable
          onClose={() => setMissingAfterVoice([])}
          message={`AI 没识别到:${missingAfterVoice.join('、')},请下方补充`}
          style={{ marginBottom: 12, fontSize: 13 }}
        />
      )}

      {/* K 模块 — 机构匹配状态 */}
      {voiceHasRun && matchedOrgId && matchedOrgName && (
        <Alert
          type="success"
          showIcon
          message={`🤖 AI 已匹配机构:${matchedOrgName}`}
          style={{ marginBottom: 12, fontSize: 13 }}
        />
      )}
      {voiceHasRun && !matchedOrgId && form.getFieldValue('department') && (
        <Alert
          type="warning"
          showIcon
          message={`⚠ 已识别"${form.getFieldValue('department')}",但未匹配到机构库,提交后将作为自由文本保存,你可以稍后回桌面端补关联`}
          style={{ marginBottom: 12, fontSize: 13 }}
        />
      )}

      {/* GPS 一键定位 — HTTPS 上线后启用,失败 fallback 到下方手选 */}
      <div style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          size="large"
          block
          icon={<EnvironmentOutlined />}
          loading={gpsLoading}
          onClick={handleGpsLocate}
          style={{ height: 56, fontSize: 16 }}
        >
          一键定位(GPS)
        </Button>
        {gpsHint && (
          <Text
            type={gpsHint.startsWith('✓') ? 'success' : 'secondary'}
            style={{
              fontSize: 12,
              display: 'block',
              textAlign: 'center',
              marginTop: 6,
            }}
          >
            {gpsHint}
          </Text>
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
        onValuesChange={handleValuesChange}
        disabled={submitMutation.isPending}
      >
        <Form.Item
          label="拜访日期"
          name="visitDate"
          rules={[{ required: true }]}
        >
          <DatePicker style={{ width: '100%' }} inputReadOnly />
        </Form.Item>
        <Form.Item
          label="省"
          name="provinceCode"
          rules={[{ required: true }]}
        >
          <Select
            options={provinceOptions}
            onChange={() =>
              form.setFieldsValue({ cityName: undefined as unknown as string })
            }
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
        <Form.Item
          label="对接部门"
          name="department"
          rules={[{ required: true, max: 128 }]}
        >
          <Input placeholder="例:上海市发改委" maxLength={128} />
        </Form.Item>
        <Form.Item
          label="对接人"
          name="contactPerson"
          rules={[{ required: true, max: 64 }]}
        >
          <Input placeholder="例:张处长" maxLength={64} />
        </Form.Item>
        <Form.Item
          label="对接人职务(可选)"
          name="contactTitle"
          rules={[{ max: 64 }]}
        >
          <Input placeholder="例:综合处处长" maxLength={64} />
        </Form.Item>
        <Form.Item
          label="产出描述"
          name="outcomeSummary"
          rules={[{ required: true }]}
        >
          <Input.TextArea
            rows={4}
            placeholder="一句话总结这次拜访的产出"
            maxLength={500}
            showCount
          />
        </Form.Item>
        <Form.Item label="颜色" name="color" rules={[{ required: true }]}>
          <Radio.Group buttonStyle="solid" style={{ width: '100%', display: 'flex' }}>
            <Radio.Button
              value="green"
              style={{
                flex: 1,
                textAlign: 'center',
                height: 44,
                lineHeight: '40px',
              }}
            >
              🟢 常规
            </Radio.Button>
            <Radio.Button
              value="yellow"
              style={{
                flex: 1,
                textAlign: 'center',
                height: 44,
                lineHeight: '40px',
              }}
            >
              🟡 层级提升
            </Radio.Button>
            <Radio.Button
              value="red"
              style={{
                flex: 1,
                textAlign: 'center',
                height: 44,
                lineHeight: '40px',
              }}
            >
              🔴 紧急
            </Radio.Button>
          </Radio.Group>
        </Form.Item>
        <Form.Item
          label="是否需要后续跟进"
          name="followUp"
          valuePropName="checked"
        >
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
