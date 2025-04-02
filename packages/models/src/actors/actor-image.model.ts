export interface ActorImage {
  width: number

  // TODO: remove, deprecated in 7.1
  path: string
  // TODO: remove, deprecated in 7.1
  url?: string

  fileUrl: string

  createdAt: Date | string
  updatedAt: Date | string
}
