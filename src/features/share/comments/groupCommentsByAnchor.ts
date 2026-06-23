import type { Comment } from './commentTypes'

export interface CommentElementGroup {
  id: string
  title: string
  comments: Comment[]
}

export interface GroupedComments {
  elementGroups: CommentElementGroup[]
  mapWide: Comment[]
}

interface TitledNode {
  id: string
  title?: string
}

interface TitledEdge {
  id: string
  label?: string
}

export function groupCommentsByAnchor(
  comments: Comment[],
  nodes: Map<string, TitledNode>,
  edges: Map<string, TitledEdge>,
): GroupedComments {
  const groups = new Map<string, CommentElementGroup>()
  const mapWide: Comment[] = []

  for (const comment of comments) {
    if (comment.anchor.kind === 'map') {
      mapWide.push(comment)
      continue
    }

    const id = comment.anchor.kind === 'node' ? comment.anchor.nodeId : comment.anchor.edgeId
    const existing = groups.get(id)

    if (existing) {
      existing.comments.push(comment)
      continue
    }

    groups.set(id, {
      id,
      title: resolveAnchorTitle(comment, nodes, edges),
      comments: [comment],
    })
  }

  const elementGroups = Array.from(groups.values()).map((group) => ({
    ...group,
    comments: sortCommentsChronologically(group.comments),
  }))

  elementGroups.sort((a, b) => {
    const byOpenCount = countOpenComments(b.comments) - countOpenComments(a.comments)
    if (byOpenCount !== 0) return byOpenCount
    return a.id.localeCompare(b.id)
  })

  return {
    elementGroups,
    mapWide: sortCommentsChronologically(mapWide),
  }
}

function resolveAnchorTitle(
  comment: Comment,
  nodes: Map<string, TitledNode>,
  edges: Map<string, TitledEdge>,
): string {
  if (comment.anchor.kind === 'node') return nodes.get(comment.anchor.nodeId)?.title ?? 'Untitled element'
  if (comment.anchor.kind === 'edge') return edges.get(comment.anchor.edgeId)?.label ?? 'Untitled element'
  return 'Whole map'
}

function countOpenComments(comments: Comment[]): number {
  return comments.filter((comment) => comment.status === 'open').length
}

function sortCommentsChronologically(comments: Comment[]): Comment[] {
  return [...comments].sort((a, b) => {
    const byCreatedAt = Date.parse(a.createdAt) - Date.parse(b.createdAt)
    if (byCreatedAt !== 0) return byCreatedAt
    return a.id.localeCompare(b.id)
  })
}
