/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { ThrottleStream } from '@peertube/peertube-server/core/helpers/stream-throttle.js'

async function collectStream (readable: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

async function throttledCollect (
  input: Buffer,
  options: ConstructorParameters<typeof ThrottleStream>[0]
): Promise<{ body: Buffer, elapsed: number }> {
  const throttle = new ThrottleStream(options)
  const readable = Readable.from([ input ])

  const start = Date.now()
  const chunks: Buffer[] = []

  await pipeline(readable, throttle, async function (source) {
    for await (const chunk of source) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
  })

  return { body: Buffer.concat(chunks), elapsed: Date.now() - start }
}

describe('ThrottleStream', function () {
  describe('Constructor validation', function () {
    it('Should throw when neither totalBytesPerSecond nor bytesPerIpPerSecond is provided', function () {
      expect(() => new ThrottleStream({})).to.throw('At least one throttle speed must be provided')
    })

    it('Should throw when both values are explicitly undefined', function () {
      expect(() => new ThrottleStream({ totalBytesPerSecond: undefined, bytesPerIpPerSecond: undefined })).to.throw(
        'At least one throttle speed must be provided'
      )
    })

    it('Should not throw when totalBytesPerSecond is provided', function () {
      expect(() => new ThrottleStream({ totalBytesPerSecond: 1024 })).to.not.throw()
    })

    it('Should not throw when bytesPerIpPerSecond is provided', function () {
      expect(() => new ThrottleStream({ bytesPerIpPerSecond: 1024, ip: '127.0.0.1' })).to.not.throw()
    })

    it('Should not throw when both are provided', function () {
      expect(() => new ThrottleStream({ totalBytesPerSecond: 1024, bytesPerIpPerSecond: 512, ip: '127.0.0.1' })).to.not.throw()
    })
  })

  describe('Byte preservation', function () {
    it('Should pass through all bytes unchanged', async function () {
      const input = Buffer.from('hello world, this is a test of the throttle stream')
      const { body } = await throttledCollect(input, { totalBytesPerSecond: 1024 * 1024 })
      expect(body).to.deep.equal(input)
    })

    it('Should preserve bytes across multiple chunks', async function () {
      const chunk1 = Buffer.from('first chunk ')
      const chunk2 = Buffer.from('second chunk')
      const throttle = new ThrottleStream({ totalBytesPerSecond: 1024 * 1024 })
      const readable = Readable.from([ chunk1, chunk2 ])

      const chunks: Buffer[] = []
      await pipeline(readable, throttle, async function (source) {
        for await (const chunk of source) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        }
      })

      const result = Buffer.concat(chunks)
      expect(result).to.deep.equal(Buffer.concat([ chunk1, chunk2 ]))
    })

    it('Should handle an empty stream', async function () {
      const throttle = new ThrottleStream({ totalBytesPerSecond: 1024 })
      const readable = Readable.from([])

      const body = await collectStream(readable.pipe(throttle))
      expect(body.length).to.equal(0)
    })

    it('Should handle a single-byte chunk', async function () {
      const input = Buffer.from([ 0x42 ])
      const { body } = await throttledCollect(input, { totalBytesPerSecond: 1024 * 1024 })
      expect(body).to.deep.equal(input)
    })
  })

  describe('Rate enforcement — totalBytesPerSecond', function () {
    it('Should complete near-instantly when rate is much higher than data size', async function () {
      const input = Buffer.alloc(1024) // 1 KB
      const { elapsed } = await throttledCollect(input, { totalBytesPerSecond: 100 * 1024 * 1024 }) // 100 MB/s

      expect(elapsed).to.be.lessThan(500)
    })

    it('Should take at least the expected time when rate is constrained', async function () {
      const bytesPerSecond = 10 * 1024 // 10 KB/s
      const chunkSize = bytesPerSecond / 10 // 10 chunks of 1 KB each
      const chunks = Array.from({ length: 10 }, () => Buffer.alloc(chunkSize))
      const totalBytes = chunkSize * chunks.length

      const throttle = new ThrottleStream({ totalBytesPerSecond: bytesPerSecond })
      const readable = Readable.from(chunks)
      const out: Buffer[] = []

      const start = Date.now()
      await pipeline(readable, throttle, async function (source) {
        for await (const chunk of source) {
          out.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        }
      })
      const elapsed = Date.now() - start

      expect(Buffer.concat(out).length).to.equal(totalBytes)
      // 10 chunks: first passes immediately, remaining 9 each wait ~100ms → ~900ms
      expect(elapsed).to.be.at.least(700)
    })
  })

  describe('Rate enforcement — bytesPerIpPerSecond', function () {
    it('Should complete near-instantly when rate is much higher than data size', async function () {
      this.timeout(5000)

      const input = Buffer.alloc(1024)
      const { elapsed } = await throttledCollect(input, { bytesPerIpPerSecond: 100 * 1024 * 1024, ip: '10.0.0.1' })

      expect(elapsed).to.be.lessThan(500)
    })

    it('Should take at least the expected time when rate is constrained', async function () {
      const bytesPerSecond = 10 * 1024 // 10 KB/s
      const chunkSize = bytesPerSecond / 10 // 10 chunks of 1 KB each
      const chunks = Array.from({ length: 10 }, () => Buffer.alloc(chunkSize))
      const totalBytes = chunkSize * chunks.length

      const throttle = new ThrottleStream({ bytesPerIpPerSecond: bytesPerSecond, ip: '10.0.0.2' })
      const readable = Readable.from(chunks)
      const out: Buffer[] = []

      const start = Date.now()
      await pipeline(readable, throttle, async function (source) {
        for await (const chunk of source) {
          out.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        }
      })
      const elapsed = Date.now() - start

      expect(Buffer.concat(out).length).to.equal(totalBytes)
      // 10 chunks: first passes immediately, remaining 9 each wait ~100ms → ~900ms
      expect(elapsed).to.be.at.least(700)
    })

    it('Should not throttle when no IP is provided even with bytesPerIpPerSecond set', async function () {
      this.timeout(5000)

      // Without an IP the per-IP limiter should not apply
      const input = Buffer.alloc(50 * 1024)
      const { elapsed } = await throttledCollect(input, { bytesPerIpPerSecond: 1024 }) // 1 KB/s would be very slow

      expect(elapsed).to.be.lessThan(2000)
    })
  })
})
