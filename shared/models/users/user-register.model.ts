export interface UserRegister {
  username: string
  password: string
  email: string

  channel?: {
    name: string
    displayName: string
  }
}
