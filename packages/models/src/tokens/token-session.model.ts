export interface TokenSession {
  id: number

  currentSession: boolean

  loginDevice: string
  loginIP: string
  loginDate: Date | string

  lastActivityDevice: string
  lastActivityIP: string
  lastActivityDate: Date | string

  createdAt: Date | string
}
