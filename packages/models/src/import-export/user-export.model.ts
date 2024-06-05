import { UserExportStateType } from './user-export-state.enum.js'

export interface UserExport {
  id: number

  state: {
    id: UserExportStateType
    label: string
  }

  // In bytes
  size: number

  fileUrl: string
  privateDownloadUrl: string

  createdAt: string | Date
  expiresOn: string | Date
}
