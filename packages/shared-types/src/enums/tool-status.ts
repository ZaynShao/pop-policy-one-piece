export const ToolStatus = { Draft: 'draft', Published: 'published', Archived: 'archived' } as const;
export type ToolStatus = (typeof ToolStatus)[keyof typeof ToolStatus];
