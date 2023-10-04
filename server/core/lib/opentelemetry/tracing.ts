import type { Span, Tracer } from '@opentelemetry/api'
import { logger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'

let tracer: Tracer | TrackerMock

async function registerOpentelemetryTracing () {
  if (CONFIG.OPEN_TELEMETRY.TRACING.ENABLED !== true) {
    tracer = new TrackerMock()

    return
  }

  const { diag, DiagLogLevel, trace } = await import('@opentelemetry/api')
  tracer = trace.getTracer('peertube')

  const [
    { JaegerExporter },
    { registerInstrumentations },
    DnsInstrumentation,
    ExpressInstrumentation,
    { FsInstrumentation },
    { HttpInstrumentation },
    IORedisInstrumentation,
    PgInstrumentation,
    { SequelizeInstrumentation },
    Resource,
    BatchSpanProcessor,
    NodeTracerProvider,
    SemanticResourceAttributes
  ] = await Promise.all([
    import('@opentelemetry/exporter-jaeger'),
    import('@opentelemetry/instrumentation'),
    import('@opentelemetry/instrumentation-dns'),
    import('@opentelemetry/instrumentation-express'),
    import('@opentelemetry/instrumentation-fs'),
    import('@opentelemetry/instrumentation-http'),
    import('@opentelemetry/instrumentation-ioredis'),
    import('@opentelemetry/instrumentation-pg'),
    import('opentelemetry-instrumentation-sequelize'),
    import('@opentelemetry/resources'),
    import('@opentelemetry/sdk-trace-base'),
    import('@opentelemetry/sdk-trace-node'),
    import('@opentelemetry/semantic-conventions')
  ])

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

  const tracerProvider = new NodeTracerProvider.default.NodeTracerProvider({
    resource: new Resource.default.Resource({
      [SemanticResourceAttributes.default.SemanticResourceAttributes.SERVICE_NAME]: 'peertube'
    })
  })

  registerInstrumentations({
    tracerProvider,
    instrumentations: [
      new PgInstrumentation.default.PgInstrumentation({
        enhancedDatabaseReporting: true
      }),
      new DnsInstrumentation.default.DnsInstrumentation(),
      new HttpInstrumentation(),
      new ExpressInstrumentation.default.ExpressInstrumentation(),
      new IORedisInstrumentation.default.IORedisInstrumentation({
        dbStatementSerializer: function (cmdName, cmdArgs) {
          return [ cmdName, ...cmdArgs ].join(' ')
        }
      }),
      new FsInstrumentation(),
      new SequelizeInstrumentation()
    ]
  })

  tracerProvider.addSpanProcessor(
    new BatchSpanProcessor.default.BatchSpanProcessor(
      new JaegerExporter({ endpoint: CONFIG.OPEN_TELEMETRY.TRACING.JAEGER_EXPORTER.ENDPOINT })
    )
  )

  tracerProvider.register()
}

async function wrapWithSpanAndContext <T> (spanName: string, cb: () => Promise<T>) {
  const { context, trace } = await import('@opentelemetry/api')

  if (CONFIG.OPEN_TELEMETRY.TRACING.ENABLED !== true) {
    return cb()
  }

  const span = tracer.startSpan(spanName)
  const activeContext = trace.setSpan(context.active(), span as Span)

  const result = await context.with(activeContext, () => cb())
  span.end()

  return result
}

export {
  registerOpentelemetryTracing,
  tracer,
  wrapWithSpanAndContext
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

class TrackerMock {
  startSpan () {
    return new SpanMock()
  }
}

class SpanMock {
  end () {

  }
}
