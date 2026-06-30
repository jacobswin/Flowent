import { z } from 'zod'

export const commentAuthorSchema = z.object({
  name: z.string().min(1).max(40),
  role: z.string().min(1).max(40),
})

export const commentAnchorSchema = z.union([
  z.object({ kind: z.literal('node'), nodeId: z.string().min(1) }),
  z.object({ kind: z.literal('edge'), edgeId: z.string().min(1) }),
  z.object({ kind: z.literal('map') }),
])

export const commentSchema = z.object({
  id: z.string().min(1),
  mapId: z.string().min(1),
  anchor: commentAnchorSchema,
  author: commentAuthorSchema,
  body: z.string().min(1).max(2000),
  status: z.enum(['open', 'resolved']),
  createdAt: z.string().min(1),
  resolvedAt: z.string().optional(),
  resolvedBy: z.string().optional(),
})

export type CommentRecord = z.infer<typeof commentSchema>

export type CommentPatch = Partial<Pick<CommentRecord, 'status' | 'resolvedAt' | 'resolvedBy'>>

export function appendComment(
  comments: Record<string, CommentRecord[]>,
  mapId: string,
  comment: CommentRecord,
): Record<string, CommentRecord[]> {
  const bucket = comments[mapId] ? [...comments[mapId]] : []
  bucket.push(comment)
  return { ...comments, [mapId]: bucket }
}

export function applyCommentPatch(
  comments: Record<string, CommentRecord[]>,
  mapId: string,
  commentId: string,
  patch: CommentPatch,
): Record<string, CommentRecord[]> {
  const bucket = comments[mapId]
  if (!bucket) throw new Error(`No comments for map ${mapId}`)

  const index = bucket.findIndex((comment) => comment.id === commentId)
  if (index === -1) throw new Error(`Comment ${commentId} not found for map ${mapId}`)

  const next = bucket.slice()
  const existing = next[index]
  if (!existing) throw new Error(`Comment ${commentId} not found for map ${mapId}`)

  let updated: CommentRecord = { ...existing, ...patch }
  if (patch.status === 'open') {
    updated = { ...updated, resolvedAt: undefined, resolvedBy: undefined }
  }
  next[index] = updated

  return { ...comments, [mapId]: next }
}

export function deleteComment(
  comments: Record<string, CommentRecord[]>,
  mapId: string,
  commentId: string,
): Record<string, CommentRecord[]> {
  const bucket = comments[mapId]
  if (!bucket) return comments
  return { ...comments, [mapId]: bucket.filter((comment) => comment.id !== commentId) }
}
