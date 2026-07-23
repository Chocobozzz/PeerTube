export type BlocklistLogAction = 'add' | 'delete'

export interface BlocklistLog {
  id: number
  action: BlocklistLogAction
  target: string
  createdAt: Date | string
}
