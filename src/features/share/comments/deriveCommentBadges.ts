import type { Comment } from './commentTypes'

export interface CommentBadges {
  nodeBadges: Map<string, number>
  edgeBadges: Map<string, number>
}

export function deriveCommentBadges(comments: Comment[]): CommentBadges {
  const nodeBadges = new Map<string, number>()
  const edgeBadges = new Map<string, number>()

  for (const comment of comments) {
    if (comment.status !== 'open') continue

    if (comment.anchor.kind === 'node') {
      incrementBadge(nodeBadges, comment.anchor.nodeId)
    } else if (comment.anchor.kind === 'edge') {
      incrementBadge(edgeBadges, comment.anchor.edgeId)
    }
  }

  return { nodeBadges, edgeBadges }
}

function incrementBadge(badges: Map<string, number>, id: string): void {
  badges.set(id, (badges.get(id) ?? 0) + 1)
}
