/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { randomBytes } from 'node:crypto'
import dgram from 'node:dgram'

import { cleanupTests, createSingleServer, PeerTubeServer } from '@peertube/peertube-server-commands'
import { expect } from 'chai'

const MAGIC_COOKIE = 0x2112A442

function buildBindingRequest () {
  const buf = Buffer.alloc(20)
  buf.writeUInt16BE(0x0001, 0) // Binding Request
  buf.writeUInt16BE(0x0000, 2) // Message Length
  buf.writeUInt32BE(MAGIC_COOKIE, 4) // Magic cookie
  randomBytes(12).copy(buf, 8) // Transaction ID
  return buf
}

function parseAddress (msg: Buffer, txid: Buffer) {
  // Validate success response and transaction ID
  const msgType = msg.readUInt16BE(0)
  if (msgType !== 0x0101) throw new Error('Not a success response')
  if (!msg.subarray(8, 20).equals(txid)) throw new Error('Transaction ID mismatch')

  let offset = 20
  while (offset + 4 <= msg.length) {
    const type = msg.readUInt16BE(offset)
    const len = msg.readUInt16BE(offset + 2)
    const valOffset = offset + 4
    const next = valOffset + len + ((4 - (len % 4)) % 4) // 32-bit padding

    if (type === 0x0020 /* XOR-MAPPED-ADDRESS */ || type === 0x0001 /* MAPPED-ADDRESS */) {
      const family = msg[valOffset + 1]
      let port = msg.readUInt16BE(valOffset + 2)
      let ipBuf

      if (family === 0x01) { // IPv4
        ipBuf = msg.subarray(valOffset + 4, valOffset + 8)
        if (type === 0x0020) {
          port ^= MAGIC_COOKIE >>> 16
          const cookie = Buffer.from([ 0x21, 0x12, 0xA4, 0x42 ])
          for (let i = 0; i < 4; i++) ipBuf[i] ^= cookie[i]
        }
        const ip = `${ipBuf[0]}.${ipBuf[1]}.${ipBuf[2]}.${ipBuf[3]}`
        return { ip, port }
      }
    }

    offset = next
  }

  throw new Error('No mapped address found')
}

async function testStun (url: string) {
  const socket = dgram.createSocket('udp4')
  const req = buildBindingRequest()
  const txid = req.subarray(8, 20)

  const parsed = new URL(url)

  return new Promise<void>((res, rej) => {
    const timeout = setTimeout(() => {
      socket.close()
      rej(new Error('timeout'))
    }, 3000)

    socket.once('message', msg => {
      try {
        const { ip, port } = parseAddress(msg, txid)
        expect(+port).to.be.below(65000).and.above(1024)
        expect(ip.split('.')).to.have.lengthOf(4)
        clearTimeout(timeout)
        socket.close()
        res()
      } catch (e) {
        clearTimeout(timeout)
        socket.close()
        rej(e)
      }
    })

    const port = parsed.port
      ? +parsed.port
      : 3478

    const hostname = parsed.pathname
    socket.send(req, port, hostname)
  })
}

describe('STUN servers', function () {
  let server: PeerTubeServer
  let stunServers: string[]

  before(async function () {
    this.timeout(240000)

    server = await createSingleServer(1)

    const config = await server.config.getConfig()

    stunServers = config.webrtc.stunServers
  })

  it('Should have valid STUN servers configured', async function () {
    for (const stunUrl of stunServers) {
      await testStun(stunUrl)
    }
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
