export interface VideoCreate {
  category: number
  licence: number
  language: number
  description: string
  nsfw: boolean
  name: string
  tags: string[]
}
