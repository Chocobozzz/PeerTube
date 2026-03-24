import { DropdownAction } from './action-dropdown.component'

type DropdownActionForBuilder<T, D = never> =
  & Omit<DropdownAction<T, D>, 'linkBuilder' | 'queryParamsBuilder' | 'handler'>
  & {
    handler?: (a: T[]) => any
  }
  & (
    | {
      enableBulk: true

      linkBuilder?: never
      queryParamsBuilder?: never
    }
    | {
      enableBulk: false

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
