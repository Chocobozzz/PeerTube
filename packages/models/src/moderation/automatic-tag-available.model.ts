export type AutomaticTagAvailableType = 'core' | 'watched-words-list'

export interface AutomaticTagAvailable {
  available: {
    name: string
    type: AutomaticTagAvailableType
  }[]
}
