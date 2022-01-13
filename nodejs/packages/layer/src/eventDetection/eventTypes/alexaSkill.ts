const type = 'aws.alexaskill';

export default function eventType(e: any = {}) {
  return e?.session?.attributes &&
    e?.session?.user &&
    e?.context?.System &&
    e?.request?.requestId
    ? type
    : false;
};
