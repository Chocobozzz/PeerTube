export interface VideoToken {
  files: {
    token: string
    expires: string | Date
  }
}
