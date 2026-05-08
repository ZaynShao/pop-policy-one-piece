export const ToolType = { Document: 'document', Interface: 'interface' } as const;
export type ToolType = (typeof ToolType)[keyof typeof ToolType];
