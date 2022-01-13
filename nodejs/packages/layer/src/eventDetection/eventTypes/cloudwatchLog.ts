const type = 'aws.cloudwatch.log';

export default function eventType(event: any = {}) {
  return event.awslogs && event.awslogs.data ? type : false;
};
