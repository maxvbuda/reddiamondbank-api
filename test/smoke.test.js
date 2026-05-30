// Standalone smoke test: boots an in-memory MongoDB, then exercises the
// real route handlers via supertest-style fetch against a live app instance.
// Run with: node test/smoke.test.js
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

process.env.JWT_SECRET = 'test-secret';

const express = require('express');
const cors = require('cors');
const authRoutes = require('../routes/auth');
const paymentRoutes = require('../routes/payments');

let assertions = 0;
function assert(cond, msg) {
  assertions++;
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

async function main() {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api', authRoutes);
  app.use('/api', paymentRoutes);

  const server = app.listen(0);
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  const post = (path, body, token) =>
    fetch(base + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  const get = (path, token) =>
    fetch(base + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

  // Register two users.
  let r = await post('/api/register', { username: 'alice', password: 'alice123' });
  let alice = await r.json();
  assert(r.status === 201, 'alice register status');
  assert(alice.token, 'alice gets token');
  assert(alice.user.balance === 1000, 'alice starts with 1000');
  assert(alice.user.accountNumber.startsWith('RDB'), 'account number format');

  r = await post('/api/register', { username: 'bob', password: 'bob123' });
  let bob = await r.json();
  assert(r.status === 201, 'bob register status');

  // Duplicate username rejected.
  r = await post('/api/register', { username: 'alice', password: 'whatever' });
  assert(r.status === 409, 'duplicate username rejected');

  // Login with correct + wrong password.
  r = await post('/api/login', { username: 'alice', password: 'alice123' });
  assert(r.status === 200, 'alice login ok');
  r = await post('/api/login', { username: 'alice', password: 'wrong' });
  assert(r.status === 401, 'wrong password rejected');

  // /me requires auth.
  r = await get('/api/me');
  assert(r.status === 401, 'me requires token');
  r = await get('/api/me', alice.token);
  let me = await r.json();
  assert(me.user.username === 'alice', 'me returns alice');

  // Send payment alice -> bob.
  r = await post('/api/send', { to: 'bob', amount: 250, note: 'lunch' }, alice.token);
  let sendRes = await r.json();
  assert(r.status === 200, 'send ok');
  assert(sendRes.user.balance === 750, 'alice debited to 750');

  // Bob received it.
  r = await get('/api/me', bob.token);
  me = await r.json();
  assert(me.user.balance === 1250, 'bob credited to 1250');

  // Overdraft rejected.
  r = await post('/api/send', { to: 'bob', amount: 999999, note: 'too much' }, alice.token);
  assert(r.status === 400, 'overdraft rejected');

  // Self-send rejected.
  r = await post('/api/send', { to: 'alice', amount: 10 }, alice.token);
  assert(r.status === 400, 'self-send rejected');

  // Unknown recipient rejected.
  r = await post('/api/send', { to: 'ghost', amount: 10 }, alice.token);
  assert(r.status === 404, 'unknown recipient rejected');

  // Transaction history.
  r = await get('/api/transactions', alice.token);
  let txns = await r.json();
  assert(txns.transactions.length === 1, 'alice has 1 transaction');
  assert(txns.transactions[0].toUser === 'bob', 'txn recipient is bob');

  await server.close();
  await mongoose.disconnect();
  await mongod.stop();

  console.log(`\nAll ${assertions} assertions passed.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Test crashed:', err);
  process.exit(1);
});
