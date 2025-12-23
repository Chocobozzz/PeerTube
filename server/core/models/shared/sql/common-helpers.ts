import { forceNumber } from '@peertube/peertube-core-utils'
import { FollowState } from '@peertube/peertube-models'
import { literal } from 'sequelize'
import { Literal } from 'sequelize/types/utils'

// FIXME: have to specify the result type to not break peertube typings generation
export function buildLocalAccountIdsIn (): Literal {
  return literal(
    '(SELECT "account"."id" FROM "account" INNER JOIN "actor" ON "actor"."accountId" = "account"."id" AND "actor"."serverId" IS NULL)'
  )
}

// FIXME: have to specify the result type to not break peertube typings generation
export function buildLocalActorIdsIn (): Literal {
  return literal(
    '(SELECT "actor"."id" FROM "actor" WHERE "actor"."serverId" IS NULL)'
  )
}

export function buildBlockedAccountSQL (blockerIds: number[]) {
  const blockerIdsString = blockerIds.join(', ')

  return 'SELECT "targetAccountId" AS "id" FROM "accountBlocklist" WHERE "accountId" IN (' + blockerIdsString + ')' +
    ' UNION ' +
    'SELECT "account"."id" AS "id" FROM account INNER JOIN "actor" ON account."id" = actor."accountId" ' +
    'INNER JOIN "serverBlocklist" ON "actor"."serverId" = "serverBlocklist"."targetServerId" ' +
    'WHERE "serverBlocklist"."accountId" IN (' + blockerIdsString + ')'
}

export function buildServerIdsFollowedBy (actorId: any) {
  const actorIdNumber = forceNumber(actorId)
  const followState: FollowState = 'accepted'

  return '(' +
    'SELECT "actor"."serverId" FROM "actorFollow" ' +
    'INNER JOIN "actor" ON actor.id = "actorFollow"."targetActorId" ' +
    `WHERE "actorFollow"."actorId" = ${actorIdNumber} AND "actorFollow"."state" = '${followState}'` +
    ')'
}
