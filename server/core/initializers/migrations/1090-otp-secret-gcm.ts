import { logger } from '@server/helpers/logger.js'
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'
import * as Sequelize from 'sequelize'
import { CONFIG } from '../config.js'

// Crypto is inlined (rather than imported from peertube-crypto.ts) so this migration stays a frozen,
// self-contained artifact: removing the legacy CBC fallback from the helper later cannot break it
const ENCODING = 'hex'
const KEY_LENGTH = 32

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const rows = await utils.sequelize.query<{ id: number, otpSecret: string }>(
    'SELECT "id", "otpSecret" FROM "user" WHERE "otpSecret" IS NOT NULL',
    { type: Sequelize.QueryTypes.SELECT as Sequelize.QueryTypes.SELECT, transaction: utils.transaction }
  )

  let removed = 0

  for (const { id, otpSecret } of rows) {
    try {
      // Already migrated to the GCM format (salt:iv:authTag:ciphertext)
      if (otpSecret.split(':').length === 4) continue

      const secret = decryptLegacyCBC(otpSecret, CONFIG.SECRETS.PEERTUBE)
      const newOtpSecret = encryptGCM(secret, CONFIG.SECRETS.PEERTUBE)

      await utils.sequelize.query('UPDATE "user" SET "otpSecret" = :newOtpSecret WHERE "id" = :id', {
        replacements: { newOtpSecret, id },
        transaction: utils.transaction
      })
    } catch (err) {
      // An unrecoverable secret (cannot decrypt/re-encrypt) is removed so the user falls back to
      // password-only login instead of being locked out. Never abort the migration.
      logger.error(`Failed to re-encrypt OTP secret of user ${id} to AES-256-GCM format, removing it`, { err })

      try {
        await utils.sequelize.query('UPDATE "user" SET "otpSecret" = NULL WHERE "id" = :id', {
          replacements: { id },
          transaction: utils.transaction
        })
        removed++
      } catch (removeErr) {
        logger.error(`Failed to remove OTP secret of user ${id}`, { err: removeErr })
      }
    }
  }

  if (removed > 0) {
    logger.warn(
      `OTP GCM migration removed ${removed}/${rows.length} unreadable two-factor secret(s). ` +
        `Affected users now log in with password only and must re-enroll two-factor authentication.`
    )
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  down,
  up
}

// ---------------------------------------------------------------------------

// Pre-migration format: iv:ciphertext in hex, aes-256-cbc, static 'peertube' scrypt salt
function decryptLegacyCBC (encrypted: string, secret: string) {
  const [ ivStr, ciphertext ] = encrypted.split(':')

  const key = scryptSync(secret, 'peertube', KEY_LENGTH)
  const decipher = createDecipheriv('aes-256-cbc', key, Buffer.from(ivStr, ENCODING))

  return decipher.update(ciphertext, ENCODING, 'utf8') + decipher.final('utf8')
}

// Post-migration format: salt:iv:authTag:ciphertext (hex), aes-256-gcm, random per-message salt
// Mimic function in peertube-crypto.ts
function encryptGCM (str: string, secret: string) {
  const salt = randomBytes(16)
  const iv = randomBytes(12)

  const key = scryptSync(secret, salt.toString(ENCODING), KEY_LENGTH)
  const cipher = createCipheriv('aes-256-gcm', key, iv)

  const ciphertext = cipher.update(str, 'utf8', ENCODING) + cipher.final(ENCODING)
  const authTag = cipher.getAuthTag()

  return [ salt.toString(ENCODING), iv.toString(ENCODING), authTag.toString(ENCODING), ciphertext ].join(':')
}
