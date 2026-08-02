export type AutomaticTagAvailableType = 'core' | 'watched-words-list' | 'plugin'

export interface AutomaticTagAvailable {
  available: {
    name: string
    type: AutomaticTagAvailableType
  }[]
}
