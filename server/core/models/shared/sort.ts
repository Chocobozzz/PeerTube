import { literal, OrderItem, Sequelize } from 'sequelize'

// Translate for example "-name" to [ [ 'name', 'DESC' ], [ 'id', 'ASC' ] ]
export function getSort (value: string, lastSort: OrderItem = [ 'id', 'ASC' ]): OrderItem[] {
  const { direction, field } = buildSortDirectionAndField(value)

  let finalField: string | ReturnType<typeof Sequelize.col>

  if (field.toLowerCase() === 'match') { // Search
    finalField = Sequelize.col('similarity')
  } else {
    finalField = field
  }

  return [ [ finalField, direction ], lastSort ]
}

export function getAdminUsersSort (value: string): OrderItem[] {
  const { direction, field } = buildSortDirectionAndField(value)

  let finalField: string | ReturnType<typeof Sequelize.col>

  if (field === 'videoQuotaUsed') { // Users list
    finalField = Sequelize.col('videoQuotaUsed')
  } else {
    finalField = field
  }

  const nullPolicy = direction === 'ASC'
    ? 'NULLS FIRST'
    : 'NULLS LAST'

  // FIXME: typings
  return [ [ finalField as any, direction, nullPolicy ], [ 'id', 'ASC' ] ]
}

export function getPlaylistSort (value: string, lastSort: OrderItem = [ 'id', 'ASC' ]): OrderItem[] {
  const { direction, field } = buildSortDirectionAndField(value)

  if (field.toLowerCase() === 'name') {
    return [ [ 'displayName', direction ], lastSort ]
  }

  return getSort(value, lastSort)
}

export function getVideoSort (value: string, lastSort: OrderItem = [ 'id', 'ASC' ]): OrderItem[] {
  const { direction, field } = buildSortDirectionAndField(value)

  if (field.toLowerCase() === 'trending') { // Sort by aggregation
    return [
      [ Sequelize.fn('COALESCE', Sequelize.fn('SUM', Sequelize.col('VideoViews.views')), '0'), direction ],

      [ Sequelize.col('VideoModel.views'), direction ],

      lastSort
    ]
  } else if (field === 'publishedAt') {
    return [
      [ 'ScheduleVideoUpdate', 'updateAt', direction + ' NULLS LAST' ],

      [ Sequelize.col('VideoModel.publishedAt'), direction ],

      lastSort
    ]
  }

  let finalField: string | ReturnType<typeof Sequelize.col>

  // Alias
  if (field.toLowerCase() === 'match') { // Search
    finalField = Sequelize.col('similarity')
  } else {
    finalField = field
  }

  const firstSort: OrderItem = typeof finalField === 'string'
    ? finalField.split('.').concat([ direction ]) as OrderItem
    : [ finalField, direction ]

  return [ firstSort, lastSort ]
}

export function getBlacklistSort (value: string, lastSort: OrderItem = [ 'id', 'ASC' ]): OrderItem[] {
  const { direction, field } = buildSortDirectionAndField(value)

  const videoFields = new Set([ 'name', 'duration', 'views', 'likes', 'dislikes', 'uuid' ])

  if (videoFields.has(field)) {
    return [
      [ literal(`"Video.${field}" ${direction}`) ],
      lastSort
    ] as OrderItem[]
  }

  return getSort(value, lastSort)
}

export function getInstanceFollowsSort (value: string, lastSort: OrderItem = [ 'id', 'ASC' ]): OrderItem[] {
  const { direction, field } = buildSortDirectionAndField(value)

  if (field === 'redundancyAllowed') {
    return [
      [ 'ActorFollowing.Server.redundancyAllowed', direction ],
      lastSort
    ]
  }

  return getSort(value, lastSort)
}

export function getChannelSyncSort (value: string): OrderItem[] {
  const { direction, field } = buildSortDirectionAndField(value)
  if (field.toLowerCase() === 'videochannel') {
    return [
      [ literal('"VideoChannel.name"'), direction ]
    ]
  }
  return [ [ field, direction ] ]
}

export function getSubscriptionSort (value: string): OrderItem[] {
  const { direction, field } = buildSortDirectionAndField(value)

  if (field === 'channelUpdatedAt') {
    return [
      [ literal('"ActorFollowing.VideoChannel.updatedAt"'), direction ]
    ]
  }
  return [ [ field, direction ] ]
}

export function buildSortDirectionAndField (value: string) {
  let field: string
  let direction: 'ASC' | 'DESC'

  if (value.substring(0, 1) === '-') {
    direction = 'DESC'
    field = value.substring(1)
  } else {
    direction = 'ASC'
    field = value
  }

  return { direction, field }
}
