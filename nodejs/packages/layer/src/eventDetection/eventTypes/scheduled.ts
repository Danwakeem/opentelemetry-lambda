const type = 'aws.scheduled';

export default function eventType(event: any = {}) {
  return event.source === 'aws.events' ? type : false;
};
