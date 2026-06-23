export type CommentAnchor =
  | { kind: 'node'; nodeId: string }
  | { kind: 'edge'; edgeId: string }
  | { kind: 'map' }

export type CommentStatus = 'open' | 'resolved'

export interface CommentAuthor {
  name: string
  role: string
}

export interface Comment {
  id: string
  mapId: string
  anchor: CommentAnchor
  author: CommentAuthor
  body: string
  status: CommentStatus
  createdAt: string
  resolvedAt?: string
  resolvedBy?: string
}

export const COMMENT_NAME_MAX = 40
export const COMMENT_ROLE_MAX = 40
export const COMMENT_BODY_MAX = 2000

export function isCommentAnchor(value: unknown): value is CommentAnchor {
  if (typeof value !== 'object' || value === null) return false

  const anchor = value as { kind?: unknown; nodeId?: unknown; edgeId?: unknown }
  if (anchor.kind === 'node') return typeof anchor.nodeId === 'string' && anchor.nodeId.length > 0
  if (anchor.kind === 'edge') return typeof anchor.edgeId === 'string' && anchor.edgeId.length > 0
  if (anchor.kind === 'map') return true

  return false
}

export function isComment(value: unknown): value is Comment {
  if (typeof value !== 'object' || value === null) return false

  const comment = value as Partial<Comment>
  if (typeof comment.id !== 'string' || comment.id.length === 0) return false
  if (typeof comment.mapId !== 'string' || comment.mapId.length === 0) return false
  if (!isCommentAnchor(comment.anchor)) return false
  if (!comment.author || typeof comment.author.name !== 'string' || typeof comment.author.role !== 'string') {
    return false
  }
  if (comment.author.name.length === 0 || comment.author.role.length === 0) return false
  if (typeof comment.body !== 'string' || comment.body.length === 0) return false
  if (comment.status !== 'open' && comment.status !== 'resolved') return false
  if (typeof comment.createdAt !== 'string' || Number.isNaN(Date.parse(comment.createdAt))) return false
  if (comment.resolvedAt !== undefined && typeof comment.resolvedAt !== 'string') return false
  if (comment.resolvedBy !== undefined && typeof comment.resolvedBy !== 'string') return false

  return true
}

interface CreateCommentInput {
  mapId: string
  anchor: CommentAnchor
  author: CommentAuthor
  body: string
}

export function createComment(input: CreateCommentInput): Comment {
  const name = input.author.name.trim()
  const role = input.author.role.trim()
  const body = input.body.trim()

  validateCommentField('Comment author name', 'name', name, COMMENT_NAME_MAX)
  validateCommentField('Comment author role', 'role', role, COMMENT_ROLE_MAX)
  validateCommentField('Comment body', 'body', body, COMMENT_BODY_MAX)

  return {
    id: generateCommentId(),
    mapId: input.mapId,
    anchor: input.anchor,
    author: { name, role },
    body,
    status: 'open',
    createdAt: new Date().toISOString(),
  }
}

export function resolveComment(comment: Comment, byName: string): Comment {
  return {
    ...comment,
    status: 'resolved',
    resolvedAt: new Date().toISOString(),
    resolvedBy: byName,
  }
}

export function reopenComment(comment: Comment): Comment {
  return {
    ...comment,
    status: 'open',
    resolvedAt: undefined,
    resolvedBy: undefined,
  }
}

function validateCommentField(label: string, errorName: string, value: string, max: number): void {
  if (value.length === 0) throw new Error(`${label} is required.`)
  if (value.length > max) throw new Error(`Comment ${errorName} must be ${max} chars or fewer.`)
}

function generateCommentId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 8)
  return `c-${timestamp}-${random}`
}
