import { arrayify } from '@peertube/peertube-core-utils'
import { ActivityPubIntegrityProof } from '@peertube/peertube-models'
import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'crypto'

// ---------------------------------------------------------------------------
// FEP-8b32: Object Integrity Proofs
// https://codeberg.org/fediverse/fep/src/branch/main/fep/8b32/fep-8b32.md
//
// Implements the eddsa-jcs-2022 cryptosuite (https://www.w3.org/TR/vc-di-eddsa/#eddsa-jcs-2022)
// and the Multikey representation of Ed25519 public keys (FEP-521a)
// ---------------------------------------------------------------------------

export const INTEGRITY_PROOF_TYPE = 'DataIntegrityProof'
export const INTEGRITY_PROOF_CRYPTOSUITE = 'eddsa-jcs-2022'
export const INTEGRITY_PROOF_PURPOSE = 'assertionMethod'

export function getActorEd25519KeyUrl (actorUrl: string) {
  return actorUrl + '#ed25519-key'
}

export function addIntegrityProof<T> (options: {
  data: T
  privateKey: string // Ed25519 private key, PEM PKCS8
  verificationMethod: string
  created?: Date
}): T & { proof: ActivityPubIntegrityProof } {
  const { data, privateKey, verificationMethod, created = new Date() } = options

  const unsecuredDocument = toJSONValue(data)
  delete unsecuredDocument.proof

  const proofOptions: Omit<ActivityPubIntegrityProof, 'proofValue'> = {
    type: INTEGRITY_PROOF_TYPE,
    cryptosuite: INTEGRITY_PROOF_CRYPTOSUITE,
    verificationMethod,
    proofPurpose: INTEGRITY_PROOF_PURPOSE,
    created: toXSDDateTime(created)
  }

  if (unsecuredDocument['@context'] !== undefined) {
    proofOptions['@context'] = unsecuredDocument['@context']
  }

  const signature = sign(null, buildHashData(proofOptions, unsecuredDocument), createPrivateKey(privateKey))

  const proof: ActivityPubIntegrityProof = {
    '@context': proofOptions['@context'],
    'type': proofOptions.type,
    'cryptosuite': proofOptions.cryptosuite,
    'verificationMethod': proofOptions.verificationMethod,
    'proofPurpose': proofOptions.proofPurpose,
    'proofValue': 'z' + base58btcEncode(signature),
    'created': proofOptions.created
  }

  return { ...(data as object), proof } as T & { proof: ActivityPubIntegrityProof }
}

// Returns the actor URL that is supposed to own the key used to create the proof
// Or undefined if we don't support this proof (unknown cryptosuite, expired proof...), that should then be ignored
export function getSupportedIntegrityProofActorUrl (data: any) {
  const proof = data?.proof as ActivityPubIntegrityProof
  if (!isSupportedIntegrityProof(proof)) return undefined

  const [ actorUrl ] = proof.verificationMethod.split('#')

  return actorUrl
}

export function isIntegrityProofVerified (options: {
  data: any
  publicKey: string // Ed25519 public key, PEM SPKI
}) {
  const { data, publicKey } = options

  try {
    const proof = data?.proof as ActivityPubIntegrityProof
    if (!isSupportedIntegrityProof(proof)) return false

    const unsecuredDocument = toJSONValue(data)
    delete unsecuredDocument.proof
    // Legacy JSON-LD signature has been added after the proof
    delete unsecuredDocument.signature

    const proofOptions = toJSONValue(proof)
    delete proofOptions.proofValue

    if (proofOptions['@context'] !== undefined) {
      if (!contextStartsWith(unsecuredDocument['@context'], proofOptions['@context'])) return false

      unsecuredDocument['@context'] = proofOptions['@context']
    } else if (unsecuredDocument['@context'] !== undefined) {
      proofOptions['@context'] = unsecuredDocument['@context']
    }

    const signature = base58btcDecode(proof.proofValue.substring(1))
    if (signature.length !== 64) return false

    return verify(null, buildHashData(proofOptions, unsecuredDocument), createPublicKey(publicKey), signature)
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Multikey (FEP-521a)
// ---------------------------------------------------------------------------

// Multicodec ed25519-pub (0xed) as an unsigned varint
const ED25519_PUB_MULTICODEC_PREFIX = Buffer.from([ 0xed, 0x01 ])
// DER prefix of an Ed25519 public key encoded in SubjectPublicKeyInfo format
const ED25519_SPKI_DER_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')

const ED25519_KEY_LENGTH = 32
// Multibase base58btc of 34 bytes is 46 or 47 characters long, + 1 for the multibase prefix
const MAX_MULTIBASE_PUBLIC_KEY_LENGTH = 64

export function ed25519PublicKeyToMultibase (publicKey: string) {
  const der = createPublicKey(publicKey).export({ format: 'der', type: 'spki' })

  const isEd25519 = der.length === ED25519_SPKI_DER_PREFIX.length + ED25519_KEY_LENGTH &&
    der.subarray(0, ED25519_SPKI_DER_PREFIX.length).equals(ED25519_SPKI_DER_PREFIX)

  if (!isEd25519) throw new Error('Public key is not an Ed25519 key')

  const rawKey = der.subarray(ED25519_SPKI_DER_PREFIX.length)

  return 'z' + base58btcEncode(Buffer.concat([ ED25519_PUB_MULTICODEC_PREFIX, rawKey ]))
}

// Returns undefined if the multibase value is not a valid Ed25519 public key
export function ed25519PublicKeyFromMultibase (publicKeyMultibase: string) {
  if (typeof publicKeyMultibase !== 'string') return undefined
  if (!publicKeyMultibase.startsWith('z') || publicKeyMultibase.length > MAX_MULTIBASE_PUBLIC_KEY_LENGTH) return undefined

  try {
    const decoded = base58btcDecode(publicKeyMultibase.substring(1))

    if (decoded.length !== ED25519_PUB_MULTICODEC_PREFIX.length + ED25519_KEY_LENGTH) return undefined
    if (!decoded.subarray(0, ED25519_PUB_MULTICODEC_PREFIX.length).equals(ED25519_PUB_MULTICODEC_PREFIX)) return undefined

    const der = Buffer.concat([ ED25519_SPKI_DER_PREFIX, decoded.subarray(ED25519_PUB_MULTICODEC_PREFIX.length) ])

    return createPublicKey({ key: der, format: 'der', type: 'spki' }).export({ format: 'pem', type: 'spki' }).toString()
  } catch {
    return undefined
  }
}

// ---------------------------------------------------------------------------
// JSON Canonicalization Scheme (RFC 8785)
// ---------------------------------------------------------------------------

export function canonicalizeJSON (value: unknown): string {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Cannot canonicalize a non finite number')

    // ECMAScript serialization of strings and numbers is the one required by JCS
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return '[' + value.map(v => canonicalizeJSON(v)).join(',') + ']'
  }

  // Sort by UTF-16 code units, as required by JCS
  const keys = Object.keys(value).sort((a, b) => {
    if (a < b) return -1
    if (a > b) return 1
    return 0
  })

  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalizeJSON(value[k])).join(',') + '}'
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

const MAX_PROOF_VALUE_LENGTH = 128

function isSupportedIntegrityProof (proof: ActivityPubIntegrityProof) {
  return !!proof &&
    typeof proof === 'object' &&
    !Array.isArray(proof) &&
    proof.type === INTEGRITY_PROOF_TYPE &&
    proof.cryptosuite === INTEGRITY_PROOF_CRYPTOSUITE &&
    proof.proofPurpose === INTEGRITY_PROOF_PURPOSE &&
    typeof proof.verificationMethod === 'string' &&
    typeof proof.proofValue === 'string' &&
    proof.proofValue.startsWith('z') &&
    proof.proofValue.length <= MAX_PROOF_VALUE_LENGTH &&
    !isIntegrityProofExpired(proof)
}

function isIntegrityProofExpired (proof: ActivityPubIntegrityProof) {
  if (proof.expires === undefined) return false

  const expires = new Date(proof.expires).getTime()

  return isNaN(expires) || expires < Date.now()
}

function buildHashData (proofConfig: object, unsecuredDocument: object) {
  return Buffer.concat([
    sha256Buffer(canonicalizeJSON(proofConfig)),
    sha256Buffer(canonicalizeJSON(unsecuredDocument))
  ])
}

function sha256Buffer (str: string) {
  return createHash('sha256').update(str, 'utf8').digest()
}

// Signed data is sent in JSON: drop undefined values, serialize dates etc. like the receiver will see them
function toJSONValue (data: any) {
  return JSON.parse(JSON.stringify(data))
}

// XSD dateTime without milliseconds, like the FEP-8b32 examples
function toXSDDateTime (date: Date) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

function contextStartsWith (documentContext: any, proofContext: any) {
  const documentValues = arrayify(documentContext ?? [])
  const proofValues = arrayify(proofContext)

  if (proofValues.length > documentValues.length) return false

  return proofValues.every((v, i) => canonicalizeJSON(v) === canonicalizeJSON(documentValues[i]))
}

// ---------------------------------------------------------------------------
// Base58btc (Bitcoin alphabet), used by multibase "z" prefix
// ---------------------------------------------------------------------------

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

function base58btcEncode (bytes: Uint8Array) {
  let leadingZeros = 0
  while (leadingZeros < bytes.length && bytes[leadingZeros] === 0) leadingZeros++

  let num = bytes.length === 0
    ? 0n
    : BigInt('0x' + Buffer.from(bytes).toString('hex'))

  let result = ''
  while (num > 0n) {
    result = BASE58_ALPHABET[Number(num % 58n)] + result
    num /= 58n
  }

  return '1'.repeat(leadingZeros) + result
}

function base58btcDecode (str: string) {
  let num = 0n

  for (const char of str) {
    const index = BASE58_ALPHABET.indexOf(char)
    if (index === -1) throw new Error('Invalid base58btc character')

    num = num * 58n + BigInt(index)
  }

  let leadingZeros = 0
  while (leadingZeros < str.length && str[leadingZeros] === '1') leadingZeros++

  let hex = num === 0n ? '' : num.toString(16)
  if (hex.length % 2 === 1) hex = '0' + hex

  return Buffer.concat([ Buffer.alloc(leadingZeros), Buffer.from(hex, 'hex') ])
}
