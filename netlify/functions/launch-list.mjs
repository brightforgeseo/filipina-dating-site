import { getStore } from '@netlify/blobs';
import { createLaunchHandler } from '../lib/launch-handler.mjs';
export default createLaunchHandler(() => getStore({ name: 'filwest-launch-list', consistency: 'strong' }));
export const config = { rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
