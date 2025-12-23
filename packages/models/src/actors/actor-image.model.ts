export interface ActorImage {
  height: number
  width: number

  // TODO: remove, deprecated in 8.0
  path: string

  fileUrl: string

  createdAt: Date | string
  updatedAt: Date | string
}
