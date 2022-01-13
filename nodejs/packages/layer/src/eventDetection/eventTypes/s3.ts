const type = 'aws.s3';

export default function eventType(event: any = {}) {
  const { Records = [] } = event;
  const [firstEvent = {}] = Records;
  const { eventSource } = firstEvent;
  // test is for ['2.0', '2.1'].indexOf(firstEvent.eventVersion) !== -1
  return eventSource === 'aws:s3' ? type : false;
};