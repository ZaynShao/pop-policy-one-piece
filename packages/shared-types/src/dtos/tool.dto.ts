import type { ToolType } from '../enums/tool-type';
import type { ToolStatus } from '../enums/tool-status';
import type { ToolTaxonomy } from '../enums/tool-taxonomy';

export interface Tool {
  id: string;
  type: ToolType;
  title: string;
  description: string | null;
  taxonomyTag: ToolTaxonomy;
  status: ToolStatus;
  creatorId: string;
  fileUrl: string | null;
  paramTemplate: Record<string, unknown> | null;
  responseMapping: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateDocumentToolRequestDto {
  type: 'document';
  title: string;
  description?: string;
  taxonomyTag: ToolTaxonomy;
  fileUrl: string;
}

export interface CreateInterfaceToolRequestDto {
  type: 'interface';
  title: string;
  description?: string;
  taxonomyTag: ToolTaxonomy;
  paramTemplate: Record<string, unknown>;
  responseMapping?: Record<string, unknown>;
}

export type CreateToolRequestDto = CreateDocumentToolRequestDto | CreateInterfaceToolRequestDto;

export interface UpdateToolRequestDto {
  title?: string;
  description?: string | null;
  taxonomyTag?: ToolTaxonomy;
  fileUrl?: string;
  paramTemplate?: Record<string, unknown>;
  responseMapping?: Record<string, unknown>;
}

export interface UploadUrlResponseDto {
  uploadUrl: string;
  objectKey: string;
  publicUrl: string;
}
