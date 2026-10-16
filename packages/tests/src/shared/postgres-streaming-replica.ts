import { execa } from 'execa'
import { pathExists, remove } from 'fs-extra/esm'
import { mkdir } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

// Run a temporary PostgreSQL primary and its streaming hot standby for testing purposes
export class PostgresStreamingReplica {
  readonly primaryPort = 15432
  readonly replicaPort = 15433

  private readonly dir = join(tmpdir(), 'peertube-test-pg-replica')

  async start () {
    // Clean up clusters left by an interrupted run
    await this.stop()

    await mkdir(this.dir, { recursive: true })

    await execa('initdb', [ '-D', this.getClusterDir('primary'), '-U', 'postgres', '--auth=trust' ])
    await this.startCluster('primary', this.primaryPort)

    await execa('psql', [
      '-h',
      '127.0.0.1',
      '-p',
      this.primaryPort + '',
      '-U',
      'postgres',
      '-c',
      `CREATE ROLE peertube LOGIN PASSWORD 'peertube'`
    ])

    await execa('pg_basebackup', [
      '-h',
      '127.0.0.1',
      '-p',
      this.primaryPort + '',
      '-U',
      'postgres',
      '-D',
      this.getClusterDir('replica'),
      '--write-recovery-conf',
      '--wal-method=stream'
    ])
    await this.startCluster('replica', this.replicaPort)
  }

  async stop () {
    for (const cluster of [ 'replica', 'primary' ] as const) {
      if (await pathExists(join(this.getClusterDir(cluster), 'postmaster.pid'))) {
        await execa('pg_ctl', [ '-D', this.getClusterDir(cluster), '-m', 'fast', '-w', 'stop' ])
      }
    }

    await remove(this.dir)
  }

  private startCluster (cluster: 'primary' | 'replica', port: number) {
    return execa('pg_ctl', [
      '-D',
      this.getClusterDir(cluster),
      '-l',
      join(this.dir, cluster + '.log'),
      '-w',
      '-o',
      `-p ${port} -c listen_addresses=127.0.0.1 -c unix_socket_directories=''`,
      'start'
    ])
  }

  private getClusterDir (cluster: 'primary' | 'replica') {
    return join(this.dir, cluster)
  }
}
