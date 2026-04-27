import { renderAutoComment } from '../comment-template';

describe('renderAutoComment', () => {
  it('renders full template', () => {
    const out = renderAutoComment({
      title: '拜访中芯成都',
      visitDate: '2026-04-27',
      visitorName: '系统管理员',
      department: '中芯成都',
      contactPerson: '张工',
      contactTitle: '副总',
      color: 'yellow',
      outcomeSummary: '希望补贴翻倍',
    });
    expect(out).toContain('计划点「拜访中芯成都」已完成');
    expect(out).toContain('系统管理员 拜访 中芯成都');
    expect(out).toContain('张工');
    expect(out).toContain('副总');
    expect(out).toContain('色 层级提升');
    expect(out).toContain('希望补贴翻倍');
  });

  it('handles null fields gracefully', () => {
    const out = renderAutoComment({
      title: null,
      visitDate: null,
      visitorName: '某用户',
      department: null,
      contactPerson: null,
      contactTitle: null,
      color: null,
      outcomeSummary: null,
    });
    expect(out).toContain('(无标题)');
    expect(out).toContain('(无日期)');
    expect(out).toContain('色 未知');
    expect(out).toContain('(无)');
  });
});
