import { MAX_SQL_DELETE_ITEMS } from '@server/initializers/constants.js'

export async function safeBulkDestroy (destroyFn: () => Promise<number>) {
  const destroyedRows = await destroyFn()

  if (destroyedRows === MAX_SQL_DELETE_ITEMS) {
    return safeBulkDestroy(destroyFn)
  }
}
