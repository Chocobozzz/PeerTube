import { Video } from './video.model'

export interface VideoChannel {
  id: number
  name: string
  description: string
  isLocal: boolean
  createdAt: Date | string
  updatedAt: Date | string
  owner?: {
    name: string
    uuid: string
  }
  videos?: Video[]
}
