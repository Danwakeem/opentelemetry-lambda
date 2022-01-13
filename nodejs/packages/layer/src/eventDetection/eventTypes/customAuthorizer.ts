const type = 'aws.apigateway.authorizer';

export default function eventType(event: any = {}) {
  if (typeof event === 'object') {
    const hasMethodArn = event.methodArn;
    const hasType = ['TOKEN', 'REQUEST'].includes(event.type);
    return hasMethodArn && hasType ? type : false;
  }
  return false;
};
