export class CustomError extends Error {
  serverCode: string

  constructor (message: string, serverCode: string) {
    super(message)
    this.name = 'CustomError'
    this.serverCode = serverCode
  }
}
