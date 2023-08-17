import { ApplicationModel } from '@server/models/application/application.js'

// ############################################################################

export type MApplication = Omit<ApplicationModel, 'Account'>
