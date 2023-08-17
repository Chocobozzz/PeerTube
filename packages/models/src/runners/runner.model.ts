export interface Runner {
  id: number

  name: string
  description: string

  ip: string
  lastContact: Date | string

  createdAt: Date | string
  updatedAt: Date | string
}
