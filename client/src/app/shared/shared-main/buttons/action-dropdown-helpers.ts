import { DropdownAction } from './action-dropdown.component'

export type DropdownActionForBuilder<T, D = never> =
  & Omit<DropdownAction<T, D>, 'linkBuilder' | 'queryParamsBuilder' | 'handler' | 'label'>
  & {
    handler?: (a: T[]) => any
  }
  & (
    | {
      enableBulk: true
      // Force label to be a function to avoid mistakes where the developer forgets to use the entry parameter
      // which is often needed to build the label for bulk actions
      label: (a: T[]) => string

      linkBuilder?: never
      queryParamsBuilder?: never
    }
    | {
      enableBulk: false
      label: string | ((a: T[]) => string)

      linkBuilder?: DropdownAction<T, D>['linkBuilder']
      queryParamsBuilder?: DropdownAction<T, D>['queryParamsBuilder']
    }
  )

export function buildDropdownSimpleAndBulkActions<T, D = never> (actions: DropdownActionForBuilder<T, D>[]): {
  simpleActions: DropdownAction<T, D>[]
  bulkActions: DropdownAction<T[], D>[]
}

export function buildDropdownSimpleAndBulkActions<T, D = never> (actions: DropdownActionForBuilder<T, D>[][]): {
  simpleActions: DropdownAction<T, D>[][]
  bulkActions: DropdownAction<T[], D>[][]
}

export function buildDropdownSimpleAndBulkActions<T, D = never> (
  actions: DropdownActionForBuilder<T, D>[] | DropdownActionForBuilder<T, D>[][]
) {
  if (actions.length !== 0 && Array.isArray(actions[0])) {
    const simpleActions: DropdownAction<T, D>[][] = []
    const bulkActions: DropdownAction<T[], D>[][] = []

    for (const group of actions as DropdownActionForBuilder<T, D>[][]) {
      const result = buildDropdownSimpleAndBulkActions(group)
      simpleActions.push(result.simpleActions)
      bulkActions.push(result.bulkActions)
    }

    return { simpleActions, bulkActions }
  }

  const simpleActions: DropdownAction<T, D>[] = []
  const bulkActions: DropdownAction<T[], D>[] = []

  for (const action of actions as DropdownActionForBuilder<T, D>[]) {
    simpleActions.push({
      ...action,

      label: typeof action.label === 'string'
        ? action.label
        : (entry: T) => (action.label as ((a: T[]) => string))([ entry ]),

      handler: (a: T) => {
        if (action.handler) action.handler([ a ])
      }
    })

    if (action.enableBulk) {
      bulkActions.push({
        ...action,

        isDisplayed: (entries: T[]) => {
          if (!action.isDisplayed) return true

          return entries.every(entry => action.isDisplayed(entry))
        }
      })
    }
  }

  return { simpleActions, bulkActions }
}
