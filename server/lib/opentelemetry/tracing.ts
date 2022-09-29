import { SequelizeInstrumentation } from 'opentelemetry-instrumentation-sequelize'
import { context, diag, DiagLogLevel, trace } from '@opentelemetry/api'
import { JaegerExporter } from '@opentelemetry/exporter-jaeger'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { DnsInstrumentation } from '@opentelemetry/instrumentation-dns'
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express'
import FsInstrumentation from '@opentelemetry/instrumentation-fs'
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http'
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg'
import { RedisInstrumentation } from '@opentelemetry/instrumentation-redis-4'
import { Resource } from '@opentelemetry/resources'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'
import { logger } from '@server/helpers/logger'
import { CONFIG } from '@server/initializers/config'

const tracer = trace.getTracer('peertube')

function registerOpentelemetryTracing () {
  if (CONFIG.OPEN_TELEMETRY.TRACING.ENABLED !== true) return

  logger.info('Registering Open Telemetry tracing')

  const customLogger = (level: string) => {
    return (message: string, ...args: unknown[]) => {
      let fullMessage = message

      for (const arg of args) {
        if (typeof arg === 'string') fullMessage += arg
        else break
      }

      logger[level](fullMessage)
    }
  }

  diag.setLogger({
    error: customLogger('error'),
    warn: customLogger('warn'),
    info: customLogger('info'),
    debug: customLogger('debug'),
    verbose: customLogger('verbose')
  }, DiagLogLevel.INFO)

  const tracerProvider = new NodeTracerProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'peertube'
    })
  })

  registerInstrumentations({
    tracerProvider,
    instrumentations: [
      new PgInstrumentation({
        enhancedDatabaseReporting: true
      }),
      new DnsInstrumentation(),
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
      new RedisInstrumentation({
        dbStatementSerializer: function (cmdName, cmdArgs) {
          return [ cmdName, ...cmdArgs ].join(' ')
        }
      }),
      new FsInstrumentation(),
      new SequelizeInstrumentation()
    ]
  })

  tracerProvider.addSpanProcessor(
    new BatchSpanProcessor(
      new JaegerExporter({ endpoint: CONFIG.OPEN_TELEMETRY.TRACING.JAEGER_EXPORTER.ENDPOINT })
    )
  )

  tracerProvider.register()
}

async function wrapWithSpanAndContext <T> (spanName: string, cb: () => Promise<T>) {
  const span = tracer.startSpan(spanName)
  const activeContext = trace.setSpan(context.active(), span)

  const result = await context.with(activeContext, () => cb())
  span.end()

  return result
}

export {
  registerOpentelemetryTracing,
  tracer,
  wrapWithSpanAndContext
}
