export interface ServerConfig {
  signup: {
    allowed: boolean
  }
  transcoding: {
    enabledResolutions: number[]
  }
}
