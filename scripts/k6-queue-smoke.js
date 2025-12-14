import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomSeed } from 'k6';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.4/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';

const BASE_URL = __ENV.QUEUE_BASE_URL ?? 'http://localhost:3000';
const DEDUPE = __ENV.QUEUE_DEDUPE ?? 'k6-dedupe';
const FAIL_LOG_LIMIT = Number(__ENV.QUEUE_LOG_FAIL_LIMIT ?? 5);

const failureCount = {
  create: 0,
  enqueue: 0,
  lease: 0,
  ack: 0,
};

randomSeed(Date.now());

export const options = {
  vus: Number(__ENV.QUEUE_VUS ?? 1),
  iterations: Number(__ENV.QUEUE_ITERATIONS ?? 1),
};

function jsonHeaders() {
  return { headers: { 'Content-Type': 'application/json' } };
}

function logFailure(type, res) {
  if (failureCount[type] >= FAIL_LOG_LIMIT) {
    return;
  }

  failureCount[type] += 1;
  console.error(
    `[${type}] status=${res.status} body=${res.body ?? '<empty>'}`,
  );
}

export default function queueSmoke() {
  const queueName = `k6-smoke-${__VU}-${Date.now()}`;

  const createRes = http.post(
    `${BASE_URL}/queues`,
    JSON.stringify({
      name: queueName,
      deduplicationEnabled: true,
      deduplicationWindowSeconds: 60,
      visibilityTimeoutSeconds: 15,
      maxDeliveryAttempts: 3,
    }),
    jsonHeaders(),
  );

  const createdOk =
    check(createRes, {
      'queue created 201': (r) => r.status === 201,
      'queue id returned': (r) => !!r.json('id'),
    }) ?? false;

  if (!createdOk) {
    logFailure('create', createRes);
    return;
  }

  const queueId = createRes.json('id');

  const dedupeKey = `${DEDUPE}-${__VU}-${__ITER}`;

  const enqueueRes = http.post(
    `${BASE_URL}/queues/${queueId}/messages`,
    JSON.stringify({
      payload: { action: 'k6-smoke', user: __VU },
      deduplicationKey: dedupeKey,
    }),
    jsonHeaders(),
  );

  const enqueueOk =
    check(enqueueRes, {
      'enqueue 201': (r) => r.status === 201,
      'message id returned': (r) => !!r.json('id'),
    }) ?? false;

  if (!enqueueOk) {
    logFailure('enqueue', enqueueRes);
    return;
  }

  sleep(Number(__ENV.QUEUE_POST_ENQUEUE_SLEEP ?? 0.5));

  const leaseRes = http.post(
    `${BASE_URL}/queues/${queueId}/messages/lease`,
    JSON.stringify({}),
    jsonHeaders(),
  );

  const leaseOk =
    check(leaseRes, {
      'lease 200': (r) => r.status === 200,
      'leased message matches': (r) => r.json('id') === enqueueRes.json('id'),
    }) ?? false;

  if (!leaseOk) {
    logFailure('lease', leaseRes);
    return;
  }

  const ackRes = http.post(
    `${BASE_URL}/queues/${queueId}/messages/${enqueueRes.json('id')}/ack`,
    JSON.stringify({}),
    jsonHeaders(),
  );

  const ackOk =
    check(ackRes, {
      'ack 200': (r) => r.status === 200,
    }) ?? false;

  if (!ackOk) {
    logFailure('ack', ackRes);
  }

  sleep(0.5);
}

export function handleSummary(data) {
  const reportPath = __ENV.QUEUE_K6_HTML ?? 'k6-queue-report.html';
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    [reportPath]: htmlReport(data),
  };
}
