export interface Runner {
  id: number

  name: string
  description: string

  ip: string
  lastContact: Date | string

  version: string | null

  createdAt: Date | string
  updatedAt: Date | string
}
