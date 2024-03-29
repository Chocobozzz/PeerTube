import { AccountAutomaticTagPolicyModel } from '@server/models/automatic-tag/account-automatic-tag-policy.js'

export type MAccountAutomaticTagPolicy = Omit<AccountAutomaticTagPolicyModel, 'Account' | 'AutomaticTag'>
