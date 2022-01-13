const type = 'aws.kinesis';

export default function eventType(event: any = {}) {
  const { Records = [] } = event;
  const [firstEvent = {}] = Records;
  const { eventSource } = firstEvent;
  // test is for firstEvent.eventVersion === '1.0'
  return eventSource === 'aws:kinesis' ? type : false;
};
