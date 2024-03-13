import { UserImportModel } from '@server/models/user/user-import.js'

// ############################################################################

export type MUserImport = Omit<UserImportModel, 'User'>
