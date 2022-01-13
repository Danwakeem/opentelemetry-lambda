const type = 'aws.cloudwatch.event';

export default function eventType(event: any = {}) {
  return event.source && event.detail ? type : false;
};
