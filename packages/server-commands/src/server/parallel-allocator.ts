import { randomInt } from '@peertube/peertube-core-utils'

/**
 * Split server ports between job slots to avoid conflicts in parallel test runs
 */

const MAX_JOB_SLOTS = 16

// HTTP ports of servers are 9000 + server number, so [11500, 19000[
// Secondaries listen on the primary port + 10000 up to + 10030: reserve a block of 32 server numbers per server
const SERVER_NUMBERS = { low: 2500, high: 10000, blockSize: 32 }

// RTMP and SMTP ports, between primary [11500, 19000[ and secondary [21500, 29030[ port ranges
const PORTS = { low: 19000, high: 21500 }

const jobSlot = getJobSlot()

const serverBlocksPerSlot = Math.floor((SERVER_NUMBERS.high - SERVER_NUMBERS.low) / MAX_JOB_SLOTS / SERVER_NUMBERS.blockSize)
let serverBlockIndex = randomInt(0, serverBlocksPerSlot)

const portsPerSlot = Math.floor((PORTS.high - PORTS.low) / MAX_JOB_SLOTS)
let portIndex = randomInt(0, portsPerSlot)

export function allocateParallelServerNumber () {
  if (jobSlot === undefined) return randomInt(SERVER_NUMBERS.low, SERVER_NUMBERS.high)

  const block = jobSlot * serverBlocksPerSlot + (serverBlockIndex++ % serverBlocksPerSlot)

  return SERVER_NUMBERS.low + block * SERVER_NUMBERS.blockSize
}

export function allocateParallelPort () {
  if (jobSlot === undefined) return randomInt(PORTS.low, PORTS.high)

  return PORTS.low + jobSlot * portsPerSlot + (portIndex++ % portsPerSlot)
}

// ---------------------------------------------------------------------------

function getJobSlot () {
  const slot = parseInt(process.env.PARALLEL_JOBSLOT, 10)
  if (isNaN(slot) || slot < 1) return undefined

  return (slot - 1) % MAX_JOB_SLOTS
}
