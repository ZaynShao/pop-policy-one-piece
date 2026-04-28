/**
 * 政策主题状态机(对称 Pin):
 *   draft ↔ published ↔ archived
 *   draft → published 校验 coverage 至少 1 条
 *   archived 不出现在涂层选择器但可恢复(unarchive)
 */
export type ThemeStatus = 'draft' | 'published' | 'archived';
