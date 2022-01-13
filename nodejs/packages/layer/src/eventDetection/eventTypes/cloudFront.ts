const type = 'aws.cloudfront';

export default function eventType(event: any = {}) {
  const { Records = [] } = event;
  return Records[0] && Records[0].cf ? type : false;
};
