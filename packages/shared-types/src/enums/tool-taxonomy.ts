export const ToolTaxonomy = {
  PptTemplate: 'ppt_template',
  TalkParamRef: 'talk_param_ref',
  LocalData: 'local_data',
  CooperationTemplate: 'cooperation_template',
  PolicyInterpretation: 'policy_interpretation',
  Other: 'other',
} as const;
export type ToolTaxonomy = (typeof ToolTaxonomy)[keyof typeof ToolTaxonomy];
