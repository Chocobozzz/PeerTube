// PostgreSQL WAL positions (LSN) are 64-bit integers displayed as "X/Y" (high/low 32 bits in hexadecimal)
export function parsePgLsn (lsn: string): bigint {
  const [ high, low ] = lsn.split('/')
  if (!high || !low) throw new Error(`Invalid PostgreSQL LSN "${lsn}"`)

  return (BigInt('0x' + high) << 32n) + BigInt('0x' + low)
}
