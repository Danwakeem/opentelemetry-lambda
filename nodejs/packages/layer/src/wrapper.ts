import { NodeTracerConfig, NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SDKRegistrationConfig,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
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
} from "@opentelemetry/api";
import { getEnv } from '@opentelemetry/core';

// Use require statements for instrumentation to avoid having to have transitive dependencies on all the typescript
// definitions.
const { AwsLambdaInstrumentation } = require('@opentelemetry/instrumentation-aws-lambda');
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

const instrumentations = [
  new AwsInstrumentation({
    suppressInternalInstrumentation: true,
  }),
  new AwsLambdaInstrumentation({
    requestHook: (span: any, { event = {} }: { event: any }) => {
      const eventType = detectEventType(event);
      span.setAttribute('faas.eventType', eventType);
      if (eventType === 'aws.apigateway.http') {
        span.setAttribute('faas.source', 'aws.apigateway');
        span.setAttribute('faas.accountId', event.requestContext.accountId);
        span.setAttribute('faas.apiId', event.requestContext.apiId);
        span.setAttribute('faas.resourceId', event.requestContext.resourceId);
        span.setAttribute('faas.domainPrefix', event.requestContext.domainPrefix);
        span.setAttribute('faas.domain', event.requestContext.domainName);
        span.setAttribute('faas.requestId', event.requestContext.requestId);
        span.setAttribute('faas.extendedRequestId', event.requestContext.extendedRequestId);
        span.setAttribute('faas.requestTime', event.requestContext.requestTime);
        span.setAttribute('faas.requestTimeEpoch', event.requestContext.requestTimeEpoch);
        span.setAttribute('faas.httpPath', event.requestContext.resourcePath);
        span.setAttribute('faas.httpMethod', event.requestContext.httpMethod);
        span.setAttribute('faas.xTraceId', event.headers && event.headers['X-Amzn-Trace-Id']);
        span.setAttribute('faas.userAgent', event.headers && event.headers['User-Agent']);
      } else if (eventType === 'aws.apigatewayv2.http') {
        span.setAttribute('faas.source', 'aws.apigatewayv2');
        span.setAttribute('faas.accountId', event.requestContext.accountId);
        span.setAttribute('faas.apiId', event.requestContext.apiId);
        span.setAttribute('faas.domainPrefix', event.requestContext.domainPrefix);
        span.setAttribute('faas.domain', event.requestContext.domainName);
        span.setAttribute('faas.requestId', event.requestContext.requestId);
        span.setAttribute('faas.requestTime', event.requestContext.time);
        span.setAttribute('faas.requestTimeEpoch', event.requestContext.timeEpoch);
        span.setAttribute('faas.httpPath', event.requestContext.http.path);
        span.setAttribute('faas.httpMethod', event.requestContext.http.method);
        span.setAttribute('faas.xTraceId', event.headers && event.headers['x-amzn-trace-id']);
        span.setAttribute('faas.userAgent', event.headers && event.headers['user-agent']);
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
  });
}
initializeProvider();
