import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomSeed } from 'k6';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.4/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';

const BASE_URL = __ENV.QUEUE_BASE_URL ?? 'http://localhost:3000';
const STATIC_QUEUE_ID = __ENV.QUEUE_ID;
const BASE_QUEUE_NAME = __ENV.QUEUE_NAME ?? 'k6-shared';
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

export function setup() {
  if (STATIC_QUEUE_ID) {
    return { queueId: STATIC_QUEUE_ID };
  }

  const queueName = `${BASE_QUEUE_NAME}-${Date.now()}`;
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

  if (
    !check(createRes, {
      'queue created 201': (r) => r.status === 201,
      'queue id returned': (r) => !!r.json('id'),
    })
  ) {
    logFailure('create', createRes);
    throw new Error(`Unable to create queue for setup: ${createRes.body}`);
  }

  return { queueId: createRes.json('id') };
}

export default function queueSmoke({ queueId }) {
  if (!queueId) {
    throw new Error('Queue ID not provided to default function');
  }

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

  if (
    !check(leaseRes, {
      'lease 200': (r) => r.status === 200,
      'leased message present': (r) => !!r.json('id'),
    })
  ) {
    logFailure('lease', leaseRes);
    return;
  }

  const leasedId = leaseRes.json('id');

  if (leasedId !== enqueueRes.json('id')) {
    http.post(
      `${BASE_URL}/queues/${queueId}/messages/${leasedId}/release`,
      JSON.stringify({ reason: 'k6-mismatch', delaySeconds: 0 }),
      jsonHeaders(),
    );
    return;
  }

  const ackRes = http.post(
    `${BASE_URL}/queues/${queueId}/messages/${leasedId}/ack`,
    JSON.stringify({}),
    jsonHeaders(),
  );

  if (
    !check(ackRes, {
      'ack 200': (r) => r.status === 200,
    })
  ) {
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
