import { ApplicationModel } from '@server/models/application/application'

// ############################################################################

export type MApplication = Omit<ApplicationModel, 'Account'>
