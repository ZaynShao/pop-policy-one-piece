import { useState } from 'react';
import { Form, Input, Modal, Radio, Select, Typography, Upload, message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ToolType, ToolTaxonomy } from '@pop/shared-types';
import { addBinding, createTool, getUploadUrl } from '@/api/tools';
import { ToolBindingPicker, type PendingBinding } from './ToolBindingPicker';

const { Text } = Typography;
const { Dragger } = Upload;

const TAXONOMY: { value: ToolTaxonomy; label: string }[] = [
  { value: 'ppt_template', label: 'PPT 模板' },
  { value: 'talk_param_ref', label: '谈参参考' },
  { value: 'local_data', label: '地方数据' },
  { value: 'cooperation_template', label: '合作模板' },
  { value: 'policy_interpretation', label: '政策解读' },
  { value: 'other', label: '其他' },
];

interface Props { open: boolean; onClose: () => void; }

export function ToolFormModal({ open, onClose }: Props) {
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const [type, setType] = useState<ToolType>('document');
  const [bindings, setBindings] = useState<PendingBinding[]>([]);
  const [fileUrl, setFileUrl] = useState<string>('');

  const create = useMutation({
    mutationFn: async (vals: any) => {
      const dto = type === 'document'
        ? { type: 'document' as const, title: vals.title, description: vals.description, taxonomyTag: vals.taxonomyTag, fileUrl }
        : { type: 'interface' as const, title: vals.title, description: vals.description, taxonomyTag: vals.taxonomyTag,
            paramTemplate: JSON.parse(vals.paramTemplate || '{}'), responseMapping: vals.responseMapping ? JSON.parse(vals.responseMapping) : undefined };
      const tool = await createTool(dto as any);
      for (const b of bindings) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { _tmpId, ...rest } = b as any;
        await addBinding(tool.data.id, rest);
      }
      return tool.data;
    },
    onSuccess: () => {
      message.success('已创建(draft 状态,记得 publish)');
      qc.invalidateQueries({ queryKey: ['tools'] });
      onClose();
      form.resetFields(); setBindings([]); setFileUrl('');
    },
    onError: (e) => message.error(`创建失败: ${(e as Error).message}`),
  });

  const beforeUpload = async (file: File) => {
    try {
      const r = await getUploadUrl(file.name, file.type || 'application/octet-stream');
      const put = await fetch(r.data.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } });
      if (!put.ok) { message.error('上传 OSS 失败'); return Upload.LIST_IGNORE; }
      setFileUrl(r.data.publicUrl);
      message.success('文件已上传 OSS');
    } catch (e) {
      message.error(`上传失败:${(e as Error).message}(若 OSS 凭证未配,可先用 fileUrl 文本输入手填)`);
    }
    return Upload.LIST_IGNORE;
  };

  return (
    <Modal title="新建工具" open={open} onCancel={onClose} onOk={() => form.submit()}
      okText="保存" cancelText="取消" width={720} confirmLoading={create.isPending}>
      <Radio.Group value={type} onChange={(e) => setType(e.target.value)} style={{ marginBottom: 16 }}>
        <Radio.Button value="document">成品文档</Radio.Button>
        <Radio.Button value="interface">调用接口</Radio.Button>
      </Radio.Group>
      <Form form={form} layout="vertical" onFinish={create.mutate}>
        <Form.Item label="名称" name="title" rules={[{ required: true, max: 100 }]}>
          <Input />
        </Form.Item>
        <Form.Item label="描述" name="description"><Input.TextArea rows={2} /></Form.Item>
        <Form.Item label="taxonomy" name="taxonomyTag" rules={[{ required: true }]}>
          <Select options={TAXONOMY} />
        </Form.Item>
        {type === 'document' ? (
          <Form.Item label="文件" required>
            <Dragger beforeUpload={beforeUpload} maxCount={1} multiple={false}>
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p>{fileUrl ? '已上传 ✓' : '拖拽或点击上传(PPT / PDF / Excel)'}</p>
            </Dragger>
            {fileUrl && <Text type="secondary" style={{ fontSize: 11 }}>{fileUrl}</Text>}
          </Form.Item>
        ) : (
          <>
            <Form.Item label='param_template (JSON,如 {"themeCode":"v2g"})' name="paramTemplate" rules={[{ required: true }]}>
              <Input.TextArea rows={3} />
            </Form.Item>
            <Form.Item label="response_mapping (JSON, 可空)" name="responseMapping">
              <Input.TextArea rows={2} />
            </Form.Item>
          </>
        )}
      </Form>
      <ToolBindingPicker bindings={bindings} onChange={setBindings} />
    </Modal>
  );
}
