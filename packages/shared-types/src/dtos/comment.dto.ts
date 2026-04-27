import type { CommentSource } from '../enums/comment-source';

/**
 * Comment · Pin 留言板留言(β.2.5)
 *
 * sourceType:
 * - 'manual' — Pin Drawer 用户手动留言
 * - 'auto_from_visit' — visits.update 把 status 从 planned → completed 时事务内自动 INSERT
 */
export interface Comment {
  id: string;
  parentPinId: string;
  sourceType: CommentSource;
  body: string;
  linkedVisitId: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface CreateCommentInput {
  body: string;
}
