const type = 'aws.firehose';

export default function eventType(event: any = {}) {
  const { records = [] } = event;
  return event.deliveryStreamArn && records[0] && records[0].kinesisRecordMetadata ? type : false;
};
