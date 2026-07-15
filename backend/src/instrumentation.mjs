import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';

const traceExporter = new OTLPTraceExporter({
  url: 'http://jaeger.caspermail.svc.cluster.local:4318/v1/traces'
});

const prometheusExporter = new PrometheusExporter({
  port: 9464,
  endpoint: '/metrics'
});

const sdk = new NodeSDK({
  serviceName: 'casper-backend',
  traceExporter,
  metricReader: prometheusExporter,
  instrumentations: [getNodeAutoInstrumentations()]
});

sdk.start();

process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('Tracing terminated'))
    .catch((error) => console.log('Error terminating tracing', error))
    .finally(() => process.exit(0));
});
