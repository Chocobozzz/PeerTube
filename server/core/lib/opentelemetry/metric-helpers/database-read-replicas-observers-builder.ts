import { Meter } from '@opentelemetry/api'
import { getDatabaseReadReplicas, getDatabaseReadReplicasStats } from '@server/lib/database-replicas/database-replicas.js'

export class DatabaseReadReplicasObserversBuilder {
  constructor (private readonly meter: Meter) {
  }

  buildObservers () {
    this.meter.createObservableGauge('peertube_database_read_replica_lag', {
      description: 'Upper bound of the lag of the database read replica behind the primary',
      unit: 'ms'
    }).addCallback(observableResult => {
      for (const replica of getDatabaseReadReplicas()) {
        if (!Number.isFinite(replica.lagMs)) continue

        observableResult.observe(replica.lagMs, { replica: replica.name })
      }
    })

    this.meter.createObservableGauge('peertube_database_read_replica_healthy', {
      description: 'Whether PeerTube uses the database read replica (1) or not (0)'
    }).addCallback(observableResult => {
      for (const replica of getDatabaseReadReplicas()) {
        observableResult.observe(replica.healthy ? 1 : 0, { replica: replica.name })
      }
    })

    this.meter.createObservableCounter('peertube_database_replica_eligible_queries_total', {
      description: 'SELECT queries that could use a database read replica, by the database that ran them'
    }).addCallback(observableResult => {
      const stats = getDatabaseReadReplicasStats()

      observableResult.observe(stats.replicaQueries, { database: 'replica' })
      observableResult.observe(stats.primaryFallbackQueries, { database: 'primary' })
    })
  }
}
