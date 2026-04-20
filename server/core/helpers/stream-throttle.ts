import { exists } from '@peertube/peertube-core-utils'
import { Transform, TransformCallback } from 'stream'

type SharedThrottleOptions = {
  totalBytesPerSecond?: number
  bytesPerIpPerSecond?: number
  ip?: string
}

class SharedThrottleState {
  private readonly ipNextAvailableAt = new Map<string, number>()
  private totalNextAvailableAt = 0
  private lastCleanup = 0

  async throttle (
    options: SharedThrottleOptions & {
      bytes: number
    }
  ) {
    const { bytes, totalBytesPerSecond, bytesPerIpPerSecond, ip } = options

    const now = Date.now()

    const totalReadyAt = totalBytesPerSecond
      ? Math.max(now, this.totalNextAvailableAt)
      : now

    const ipReadyAt = bytesPerIpPerSecond && ip
      ? Math.max(now, this.ipNextAvailableAt.get(ip) ?? 0)
      : now

    const readyAt = Math.max(totalReadyAt, ipReadyAt)

    if (totalBytesPerSecond) {
      this.totalNextAvailableAt = readyAt + this.computeDurationMs(bytes, totalBytesPerSecond)
    }

    if (bytesPerIpPerSecond && ip) {
      this.ipNextAvailableAt.set(ip, readyAt + this.computeDurationMs(bytes, bytesPerIpPerSecond))
    }

    this.cleanup(now)

    const delay = readyAt - now
    if (delay <= 0) return

    await new Promise<void>(resolve => setTimeout(resolve, delay))
  }

  private computeDurationMs (bytes: number, bytesPerSecond: number) {
    return Math.ceil((bytes / bytesPerSecond) * 1000)
  }

  private cleanup (now: number) {
    if (now - this.lastCleanup < 60_000) return

    this.lastCleanup = now

    for (const [ ip, nextAvailableAt ] of this.ipNextAvailableAt) {
      if (nextAvailableAt < now - 60_000) {
        this.ipNextAvailableAt.delete(ip)
      }
    }
  }
}

const sharedThrottleState = new SharedThrottleState()

/**
 * A Transform stream that throttles throughput to a given number of bytes per second.
 */
export class ThrottleStream extends Transform {
  private readonly totalBytesPerSecond?: number
  private readonly bytesPerIpPerSecond?: number
  private readonly ip?: string

  constructor (options: SharedThrottleOptions) {
    super()

    if (!exists(options.totalBytesPerSecond) && !exists(options.bytesPerIpPerSecond)) {
      throw new Error('At least one throttle speed must be provided')
    }

    if (exists(options.bytesPerIpPerSecond) && !exists(options.ip)) {
      throw new Error('An ip must be provided when bytesPerIpPerSecond is set')
    }
    this.totalBytesPerSecond = options.totalBytesPerSecond
    this.bytesPerIpPerSecond = options.bytesPerIpPerSecond
    this.ip = options.ip
  }

  _transform (chunk: Buffer, _encoding: BufferEncoding, done: TransformCallback) {
    this.handleChunk(chunk)
      .then(() => done())
      .catch(done)
  }

  _flush (done: TransformCallback) {
    return done()
  }

  private async handleChunk (chunk: Buffer) {
    if (this.totalBytesPerSecond || this.bytesPerIpPerSecond) {
      await sharedThrottleState.throttle({
        bytes: chunk.length,
        totalBytesPerSecond: this.totalBytesPerSecond,
        bytesPerIpPerSecond: this.bytesPerIpPerSecond,
        ip: this.ip
      })
    }

    this.push(chunk)
  }
}
