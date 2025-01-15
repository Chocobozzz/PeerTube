// Copy of un-maintained hpagent package with https://github.com/delvedor/hpagent/pull/114 fix

import http from 'http'
import https from 'https'
import { Socket, TcpNetConnectOpts } from 'net'
import { URL } from 'url'

type Options = {
  keepAlive: boolean
  keepAliveMsecs: number
  maxSockets: number
  maxFreeSockets: number
  scheduling: 'lifo'
  proxy: string
}

export class HttpProxyAgent extends http.Agent {
  private readonly proxy: URL
  private readonly keepAlive: boolean

  constructor (options: Options) {
    const { proxy, ...opts } = options

    super(opts)

    this.keepAlive = options.keepAlive

    this.proxy = typeof proxy === 'string'
      ? new URL(proxy)
      : proxy
  }

  createConnection (options: TcpNetConnectOpts, callback?: (err: Error, socket: Socket) => void) {
    const requestOptions = {
      method: 'CONNECT',
      host: this.proxy.hostname,
      port: this.proxy.port,
      path: `${options.host}:${options.port}`,
      setHost: false,
      headers: { connection: this.keepAlive ? 'keep-alive' : 'close', host: `${options.host}:${options.port}` },
      agent: false,
      timeout: options.timeout || 0,
      servername: undefined as string
    }

    if (this.proxy.username || this.proxy.password) {
      const base64 = Buffer.from(
        `${decodeURIComponent(this.proxy.username || '')}:${decodeURIComponent(this.proxy.password || '')}`
      ).toString('base64')

      requestOptions.headers['proxy-authorization'] = `Basic ${base64}`
    }

    if (this.proxy.protocol === 'https:') {
      requestOptions.servername = this.proxy.hostname
    }

    const request = (this.proxy.protocol === 'http:' ? http : https).request(requestOptions)
    request.once('connect', (response, socket, head) => {
      request.removeAllListeners()
      socket.removeAllListeners()
      if (response.statusCode === 200) {
        callback(null, socket)
      } else {
        socket.destroy()
        callback(new Error(`Bad response: ${response.statusCode}`), null)
      }
    })

    request.once('timeout', () => {
      request.destroy(new Error('Proxy timeout'))
    })

    request.once('error', err => {
      request.removeAllListeners()
      callback(err, null)
    })

    request.end()
  }
}

export class HttpsProxyAgent extends https.Agent {
  private readonly proxy: URL
  private readonly keepAlive: boolean

  constructor (options: Options) {
    const { proxy, ...opts } = options

    super(opts)

    this.keepAlive = options.keepAlive

    this.proxy = typeof proxy === 'string'
      ? new URL(proxy)
      : proxy
  }

  createConnection (options: TcpNetConnectOpts, callback?: (err: Error, socket: Socket) => void) {
    const requestOptions = {
      method: 'CONNECT',
      host: this.proxy.hostname,
      port: this.proxy.port,
      path: `${options.host}:${options.port}`,
      setHost: false,
      headers: { connection: this.keepAlive ? 'keep-alive' : 'close', host: `${options.host}:${options.port}` },
      agent: false,
      timeout: options.timeout || 0,
      servername: undefined as string
    }

    if (this.proxy.username || this.proxy.password) {
      const base64 = Buffer.from(
        `${decodeURIComponent(this.proxy.username || '')}:${decodeURIComponent(this.proxy.password || '')}
      `).toString('base64')

      requestOptions.headers['proxy-authorization'] = `Basic ${base64}`
    }

    // Necessary for the TLS check with the proxy to succeed.
    if (this.proxy.protocol === 'https:') {
      requestOptions.servername = this.proxy.hostname
    }

    const request = (this.proxy.protocol === 'http:' ? http : https).request(requestOptions)
    request.once('connect', (response, socket, head) => {
      request.removeAllListeners()
      socket.removeAllListeners()

      if (response.statusCode === 200) {
        try {
          // FIXME: typings doesn't include createConnection type in HTTP agent
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error
          const secureSocket = super.createConnection({ ...options, socket })
          callback(null, secureSocket)
        } catch (err) {
          socket.destroy()
          callback(err, null)
        }
      } else {
        socket.destroy()
        callback(new Error(`Bad response: ${response.statusCode}`), null)
      }
    })

    request.once('timeout', () => {
      request.destroy(new Error('Proxy timeout'))
    })

    request.once('error', err => {
      request.removeAllListeners()
      callback(err, null)
    })

    request.end()
  }
}
