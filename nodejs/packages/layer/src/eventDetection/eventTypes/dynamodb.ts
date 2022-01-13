const type = 'aws.dynamodb';

export default function eventType(event: any = {}) {
  const { Records = [] } = event;
  const [firstEvent = {}] = Records;
  const { eventSource } = firstEvent;

  return eventSource === 'aws:dynamodb' ? type : false;
};
