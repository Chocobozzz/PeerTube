import type { Span, Tracer } from '@opentelemetry/api'
import { createLogger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'

const logger = createLogger()

let tracer: Tracer | TrackerMock

async function registerOpentelemetryTracing () {
  if (CONFIG.OPEN_TELEMETRY.TRACING.ENABLED !== true) {
    tracer = new TrackerMock()

    return
  }

  const { context, diag, DiagLogLevel, propagation, trace } = await import('@opentelemetry/api')
  tracer = trace.getTracer('peertube')

  const [
    { AsyncLocalStorageContextManager },
    { CompositePropagator, W3CBaggagePropagator, W3CTraceContextPropagator },
    { OTLPTraceExporter },
    { registerInstrumentations },
    { DnsInstrumentation },
    { ExpressInstrumentation },
    { FsInstrumentation },
    { HttpInstrumentation },
    { IORedisInstrumentation },
    { PgInstrumentation },
    { SequelizeInstrumentation },
    { resourceFromAttributes },
    { BatchSpanProcessor, TracerProvider },
    { ATTR_SERVICE_NAME }
  ] = await Promise.all([
    import('@opentelemetry/context-async-hooks'),
    import('@opentelemetry/core'),
    import('@opentelemetry/exporter-trace-otlp-http'),
    import('@opentelemetry/instrumentation'),
    import('@opentelemetry/instrumentation-dns'),
    import('@opentelemetry/instrumentation-express'),
    import('@opentelemetry/instrumentation-fs'),
    import('@opentelemetry/instrumentation-http'),
    import('@opentelemetry/instrumentation-ioredis'),
    import('@opentelemetry/instrumentation-pg'),
    import('@opentelemetry/instrumentation-sequelize'),
    import('@opentelemetry/resources'),
    import('@opentelemetry/sdk-trace'),
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

  const tracerProvider = new TracerProvider({
    spanProcessors: [
      new BatchSpanProcessor({
        // Use the OTLP default endpoint (or OTEL_EXPORTER_OTLP_TRACES_ENDPOINT) if not set
        exporter: new OTLPTraceExporter({ url: CONFIG.OPEN_TELEMETRY.TRACING.OTLP_EXPORTER.ENDPOINT || undefined })
      })
    ],
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: 'peertube'
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
      new IORedisInstrumentation({
        dbStatementSerializer: function (cmdName, cmdArgs) {
          return [ cmdName, ...cmdArgs ].join(' ')
        }
      }),
      new FsInstrumentation(),
      new SequelizeInstrumentation()
    ]
  })

  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable())
  propagation.setGlobalPropagator(
    new CompositePropagator({
      propagators: [ new W3CTraceContextPropagator(), new W3CBaggagePropagator() ]
    })
  )
  trace.setGlobalTracerProvider(tracerProvider)
}

async function wrapWithSpanAndContext<T> (spanName: string, cb: () => Promise<T>) {
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
