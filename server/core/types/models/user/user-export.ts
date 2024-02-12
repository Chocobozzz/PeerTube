import { UserExportModel } from '@server/models/user/user-export.js'

// ############################################################################

export type MUserExport = Omit<UserExportModel, 'User'>
