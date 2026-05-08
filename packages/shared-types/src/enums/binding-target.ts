export const BindingTarget = { Pin: 'pin', Visit: 'visit', Region: 'region' } as const;
export type BindingTarget = (typeof BindingTarget)[keyof typeof BindingTarget];
