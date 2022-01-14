import { NodeTracerConfig, NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SDKRegistrationConfig,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { MeterProvider } from '@opentelemetry/sdk-metrics-base';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { awsLambdaDetector } from '@opentelemetry/resource-detector-aws';
import {
  detectResources,
  envDetector,
  processDetector,
} from '@opentelemetry/resources';
import { AwsInstrumentation } from '@opentelemetry/instrumentation-aws-sdk';
import {
  diag,
  DiagConsoleLogger,
  DiagLogLevel,
  Span,
} from "@opentelemetry/api";
import { getEnv } from '@opentelemetry/core';

// Use require statements for instrumentation to avoid having to have transitive dependencies on all the typescript
// definitions.
import { AwsLambdaInstrumentation } from '@opentelemetry/instrumentation-aws-lambda';
const { DnsInstrumentation } = require('@opentelemetry/instrumentation-dns');
const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');
const { GraphQLInstrumentation } = require('@opentelemetry/instrumentation-graphql');
const { GrpcInstrumentation } = require('@opentelemetry/instrumentation-grpc');
const { HapiInstrumentation } = require('@opentelemetry/instrumentation-hapi');
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
const { IORedisInstrumentation } = require('@opentelemetry/instrumentation-ioredis');
const { KoaInstrumentation } = require('@opentelemetry/instrumentation-koa');
const { MongoDBInstrumentation } = require('@opentelemetry/instrumentation-mongodb');
const { MySQLInstrumentation } = require('@opentelemetry/instrumentation-mysql');
const { NetInstrumentation } = require('@opentelemetry/instrumentation-net');
const { PgInstrumentation } = require('@opentelemetry/instrumentation-pg');
const { RedisInstrumentation } = require('@opentelemetry/instrumentation-redis');
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-proto';
import { detectEventType } from './eventDetection/index';

declare global {
  // in case of downstream configuring span processors etc
  function configureTracerProvider(tracerProvider: NodeTracerProvider): void
  function configureTracer(defaultConfig: NodeTracerConfig): NodeTracerConfig;
  function configureSdkRegistration(
    defaultSdkRegistration: SDKRegistrationConfig
  ): SDKRegistrationConfig;
}

console.log('Registering OpenTelemetry');

const meterProvider = new MeterProvider({
  exporter: new OTLPMetricExporter(),
  interval: 60000,
});
const slsMeter = meterProvider.getMeter('serverless-meter');
const counter = slsMeter.createCounter('faas.invoke');
const errorCount = slsMeter.createCounter('faas.error');

let attributes: any = {};

const instrumentations = [
  new AwsInstrumentation({
    suppressInternalInstrumentation: true,
  }),
  new AwsLambdaInstrumentation({
    requestHook: (span: Span, { event = {} }: { event: any }) => {
      const eventType = detectEventType(event);
      attributes = {
        'faas.eventType': eventType || '',
      };
      if (eventType === 'aws.apigateway.http') {
        attributes['faas.source'] = 'aws.apigateway';
        attributes['faas.accountId'] = event.requestContext.accountId;
        attributes['faas.apiId'] = event.requestContext.apiId;
        attributes['faas.resourceId'] = event.requestContext.resourceId;
        attributes['faas.domainPrefix'] = event.requestContext.domainPrefix;
        attributes['faas.domain'] = event.requestContext.domainName;
        attributes['faas.requestId'] = event.requestContext.requestId;
        attributes['faas.extendedRequestId'] = event.requestContext.extendedRequestId;
        attributes['faas.requestTime'] = event.requestContext.requestTime;
        attributes['faas.requestTimeEpoch'] = event.requestContext.requestTimeEpoch;
        attributes['faas.httpPath'] = event.requestContext.resourcePath;
        attributes['faas.httpMethod'] = event.requestContext.httpMethod;
        attributes['faas.xTraceId'] = event.headers && event.headers['X-Amzn-Trace-Id'];
        attributes['faas.userAgent'] = event.headers && event.headers['User-Agent'];
      } else if (eventType === 'aws.apigatewayv2.http') {
        attributes['faas.source'] = 'aws.apigatewayv2';
        attributes['faas.accountId'] = event.requestContext.accountId;
        attributes['faas.apiId'] = event.requestContext.apiId;
        attributes['faas.domainPrefix'] = event.requestContext.domainPrefix;
        attributes['faas.domain'] = event.requestContext.domainName;
        attributes['faas.requestId'] = event.requestContext.requestId;
        attributes['faas.requestTime'] = event.requestContext.time;
        attributes['faas.requestTimeEpoch'] = event.requestContext.timeEpoch;
        attributes['faas.httpPath'] = event.requestContext.http.path;
        attributes['faas.httpMethod'] = event.requestContext.http.method;
        attributes['faas.xTraceId'] = event.headers && event.headers['x-amzn-trace-id'];
        attributes['faas.userAgent'] = event.headers && event.headers['user-agent'];
      }
      Object.keys((attributes)).map((key) => span.setAttribute(key, attributes[key]));

      counter.add(1, attributes);
    },
    responseHook: (span, { err, res }) => {
      let jsonBody: any = {};
      try {
        jsonBody = JSON.parse(res.body);
      } catch(error) {}
      
      if (err instanceof Error) {
        span.setAttribute('faas.error', err.message);
        errorCount.add(1, attributes);
      } else if (Array.isArray(jsonBody.errors) && jsonBody.errors.length > 0) {
        span.setAttribute('faas.error', jsonBody.errors[0].message);
        errorCount.add(1, attributes);
      }
  }
  }),
  new DnsInstrumentation(),
  new ExpressInstrumentation(),
  new GraphQLInstrumentation(),
  new GrpcInstrumentation(),
  new HapiInstrumentation(),
  new HttpInstrumentation(),
  new IORedisInstrumentation(),
  new KoaInstrumentation(),
  new MongoDBInstrumentation(),
  new MySQLInstrumentation(),
  new NetInstrumentation(),
  new PgInstrumentation(),
  new RedisInstrumentation(),
];

// configure lambda logging
const logLevel = getEnv().OTEL_LOG_LEVEL
diag.setLogger(new DiagConsoleLogger(), logLevel)

// Register instrumentations synchronously to ensure code is patched even before provider is ready.
registerInstrumentations({
  instrumentations,
});

async function initializeProvider() {
  const resource = await detectResources({
    detectors: [awsLambdaDetector, envDetector, processDetector],
  });

  let config: NodeTracerConfig = {
    resource,
  };
  if (typeof configureTracer === 'function') {
    config = configureTracer(config);
  }

  const tracerProvider = new NodeTracerProvider(config);
  if (typeof configureTracerProvider === 'function') {
    configureTracerProvider(tracerProvider)
  } else {
    // defaults
    tracerProvider.addSpanProcessor(
      new BatchSpanProcessor(new OTLPTraceExporter())
    );
  }
  // logging for debug
  if (logLevel === DiagLogLevel.DEBUG) {
    tracerProvider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
  }

  let sdkRegistrationConfig: SDKRegistrationConfig = {};
  if (typeof configureSdkRegistration === 'function') {
    sdkRegistrationConfig = configureSdkRegistration(sdkRegistrationConfig);
  }
  tracerProvider.register(sdkRegistrationConfig);

  // Re-register instrumentation with initialized provider. Patched code will see the update.
  registerInstrumentations({
    instrumentations,
    tracerProvider,
    meterProvider,
  });
}
initializeProvider();
