export interface UserRegister {
  username: string
  password: string
  email: string

  displayName?: string

  channel?: {
    name: string
    displayName: string
  }
}
