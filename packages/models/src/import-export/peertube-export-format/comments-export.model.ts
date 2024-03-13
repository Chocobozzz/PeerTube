export interface CommentsExportJSON {
  comments: {
    url: string
    text: string
    createdAt: string
    videoUrl: string

    inReplyToCommentUrl?: string

    archiveFiles?: never
  }[]
}
