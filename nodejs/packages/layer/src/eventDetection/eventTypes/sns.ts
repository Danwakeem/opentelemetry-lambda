const type = 'aws.sns';

export default function eventType(event: any = {}) {
  const { Records = [] } = event;
  const [firstEvent = {}] = Records;
  const { EventSource } = firstEvent;
  // test is for firstEvent.EventVersion === '1.0'
  return EventSource === 'aws:sns' ? type : false;
};
