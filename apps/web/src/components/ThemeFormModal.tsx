import { useEffect } from 'react';
import { Form, Input, Modal, Radio, Select, message } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  THEME_TEMPLATE_LABEL,
  type Theme,
  type ThemeTemplate,
  type CreateThemeInput,
  type UpdateThemeInput,
} from '@pop/shared-types';
import { postTheme, putTheme } from '@/api/themes';

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: Theme;
}

interface FormValues {
  title: string;
  template: ThemeTemplate;
  keywords: string[];
  regionScope?: string;
}

export function ThemeFormModal({ open, onClose, editing }: Props) {
  const [form] = Form.useForm<FormValues>();
  const qc = useQueryClient();

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.setFieldsValue({
        title: editing.title,
        template: editing.template,
        keywords: editing.keywords ?? [],
        regionScope: editing.regionScope ?? undefined,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ template: 'main', keywords: [] });
    }
  }, [open, editing, form]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (editing) {
        const input: UpdateThemeInput = {
          title: values.title,
          keywords: values.keywords,
          regionScope: values.regionScope || null,
        };
        return putTheme(editing.id, input);
      } else {
        const input: CreateThemeInput = {
          title: values.title,
          template: values.template,
          keywords: values.keywords,
          regionScope: values.regionScope,
        };
        return postTheme(input);
      }
    },
    onSuccess: () => {
      message.success(editing ? '已保存' : '已创建');
      qc.invalidateQueries({ queryKey: ['themes'] });
      onClose();
    },
    onError: (err) => message.error(`保存失败: ${(err as Error).message}`),
  });

  return (
    <Modal
      open={open}
      title={editing ? '编辑政策主题' : '新建政策主题'}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="保存"
      cancelText="取消"
      confirmLoading={mutation.isPending}
      width={520}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={(v) => mutation.mutate(v)}>
        <Form.Item label="模板" name="template" rules={[{ required: true }]}>
          <Radio.Group disabled={!!editing}>
            <Radio value="main">{THEME_TEMPLATE_LABEL.main}</Radio>
            <Radio value="risk">{THEME_TEMPLATE_LABEL.risk}</Radio>
          </Radio.Group>
        </Form.Item>
        <Form.Item label="标题" name="title" rules={[{ required: true, max: 100 }]}>
          <Input maxLength={100} placeholder="比如:智能网联汽车主线政策" />
        </Form.Item>
        <Form.Item label="关键词" name="keywords">
          <Select mode="tags" placeholder="按回车添加,如:数据出境 / 个保法" />
        </Form.Item>
        <Form.Item label="地域范围" name="regionScope">
          <Input placeholder="可选,如:全国 / 长三角 / 粤港澳大湾区" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
