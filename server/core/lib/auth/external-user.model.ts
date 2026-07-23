import { MUser } from '@server/types/models/index.js'

export type ExternalUser =
  & Pick<MUser, 'username' | 'email' | 'role' | 'adminFlags' | 'videoQuotaDaily' | 'videoQuota' | 'language'>
  & { displayName: string, externalId?: string }
