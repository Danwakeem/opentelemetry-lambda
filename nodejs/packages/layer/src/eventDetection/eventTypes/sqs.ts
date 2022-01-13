const type = 'aws.sqs';

export default function eventType(event: any = {}) {
  const { Records = [] } = event;
  const [firstEvent = {}] = Records;
  const { eventSource } = firstEvent;
  return eventSource === 'aws:sqs' ? type : false;
};
