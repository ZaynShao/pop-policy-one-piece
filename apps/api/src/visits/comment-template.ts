import type { VisitStatusColor } from '@pop/shared-types';

const COLOR_ZH: Partial<Record<VisitStatusColor, string>> = {
  red: '紧急',
  yellow: '层级提升',
  green: '常规',
  // blue 不参与(planned 状态不会触发自动留言)
};

interface RenderInput {
  title: string | null;
  visitDate: string | null;
  visitorName: string;
  department: string | null;
  contactPerson: string | null;
  contactTitle: string | null;
  color: VisitStatusColor | null;
  outcomeSummary: string | null;
}

export function renderAutoComment(input: RenderInput): string {
  const colorZh = input.color ? (COLOR_ZH[input.color] ?? '未知') : '未知';
  return [
    `✅ 计划点「${input.title ?? '(无标题)'}」已完成。`,
    `${input.visitDate ?? '(无日期)'} ${input.visitorName} 拜访 ${input.department ?? '(无部门)'}`,
    `(${input.contactPerson ?? '(无对接人)'} ${input.contactTitle ?? ''})`,
    `,色 ${colorZh},摘要:${input.outcomeSummary ?? '(无)'}`,
  ].join('');
}
