export class PeerTubeReconnectError extends Error {
  alreadyNotified: boolean

  constructor (message: string, alreadyNotified: boolean) {
    super(message)

    this.name = 'PeerTubeReconnectError'
    this.alreadyNotified = alreadyNotified

    Object.setPrototypeOf(this, PeerTubeReconnectError.prototype)
  }
}

export class PeerTubeHTTPError extends Error {
  status: number
  body: any
  headers: any
  url: string

  constructor (message: string, meta: {
    status: number
    body: any
    headers: any
    url: string
  }) {
    super(message)

    this.name = 'HTTPError'
    this.status = meta.status
    this.body = meta.body
    this.headers = meta.headers
    this.url = meta.url

    Object.setPrototypeOf(this, PeerTubeHTTPError.prototype)
  }
}
