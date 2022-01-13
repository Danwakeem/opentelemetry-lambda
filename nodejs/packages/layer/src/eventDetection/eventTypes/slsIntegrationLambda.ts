const type = 'aws.apigateway.http';

const keys = ['body', 'method', 'principalId', 'stage'];

const keysThatNeedValues = ['identity.userAgent', 'identity.sourceIp', 'identity.accountId'];

export default function eventType(event: any = {}) {
  if (typeof event === 'object') {
    const keysArePresent = keys.every((key) => key in event);
    const valuesArePresent =
      keysThatNeedValues
        .map((key) => {
          return typeof event?.key !== 'undefined';
        })
        .filter(Boolean).length === keysThatNeedValues.length;
    return keysArePresent && valuesArePresent ? type : false;
  }
  return false;
};
