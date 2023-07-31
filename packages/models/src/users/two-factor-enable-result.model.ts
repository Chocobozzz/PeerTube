export interface TwoFactorEnableResult {
  otpRequest: {
    requestToken: string
    secret: string
    uri: string
  }
}
