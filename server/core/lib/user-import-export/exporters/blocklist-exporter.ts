import { AbstractUserExporter } from './abstract-user-exporter.js'
import { ServerBlocklistModel } from '@server/models/server/server-blocklist.js'
import { AccountBlocklistModel } from '@server/models/account/account-blocklist.js'
import { BlocklistExportJSON } from '@peertube/peertube-models'

export class BlocklistExporter extends AbstractUserExporter <BlocklistExportJSON> {

  async export () {
    const [ instancesBlocklist, accountsBlocklist ] = await Promise.all([
      ServerBlocklistModel.listHostsBlockedBy([ this.user.Account.id ]),
      AccountBlocklistModel.listHandlesBlockedBy([ this.user.Account.id ])
    ])

    return {
      json: {
        instances: instancesBlocklist.map(b => ({ host: b })),
        actors: accountsBlocklist.map(h => ({ handle: h }))
      } as BlocklistExportJSON,

      staticFiles: []
    }
  }

}
