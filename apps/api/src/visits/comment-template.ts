import type { VisitStatusColor } from '@pop/shared-types';

/**
 * 自动留言只在 planned → completed 时触发,此时 color 必为 red/yellow/green
 * blue 仅占位 planned 状态,不参与渲染 — 类型上 Exclude 掉
 */
type CompletedColor = Exclude<VisitStatusColor, 'blue'>;

const COLOR_ZH: Record<CompletedColor, string> = {
  red: '紧急',
  yellow: '层级提升',
  green: '常规',
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
  const colorZh =
    input.color && input.color !== 'blue' ? COLOR_ZH[input.color] : '未知';
  return [
    `✅ 计划点「${input.title ?? '(无标题)'}」已完成。`,
    `${input.visitDate ?? '(无日期)'} ${input.visitorName} 拜访 ${input.department ?? '(无部门)'}`,
    `(${input.contactPerson ?? '(无对接人)'} ${input.contactTitle ?? ''})`,
    `,色 ${colorZh},摘要:${input.outcomeSummary ?? '(无)'}`,
  ].join('');
}
