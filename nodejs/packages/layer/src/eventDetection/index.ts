'use strict';

import alexaSkill from './eventTypes/alexaSkill';
import apiGateway from './eventTypes/apiGateway';
import apiGatewayV2 from './eventTypes/apiGatewayV2';
import customAuthorizer from './eventTypes/customAuthorizer';
import cloudFront from './eventTypes/cloudFront';
import cloudwatchEvent from './eventTypes/cloudwatchEvent';
import cloudwatchLogs from './eventTypes/cloudwatchLog';
import dynamodb from './eventTypes/dynamodb';
import firehose from './eventTypes/firehose';
import kinesis from './eventTypes/kinesis';
import s3 from './eventTypes/s3';
import scheduled from './eventTypes/scheduled';
import ses from './eventTypes/ses';
import sns from './eventTypes/sns';
import sqs from './eventTypes/sqs';

export const detectEventType = (event: any) =>
  alexaSkill(event) ||
  // Custom authorizer must come before apiGateway because they share similar keys.
  customAuthorizer(event) ||
  apiGateway(event) ||
  apiGatewayV2(event) ||
  cloudFront(event) ||
  cloudwatchLogs(event) ||
  firehose(event) ||
  kinesis(event) ||
  s3(event) ||
  scheduled(event) ||
  ses(event) ||
  sns(event) ||
  sqs(event) ||
  dynamodb(event) ||
  // Cloudwatch events should be last because it lacks distinguishing characteristics
  // and closely resembles a scheduled event
  cloudwatchEvent(event) ||
  null;
