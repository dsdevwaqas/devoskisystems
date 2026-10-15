import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateFields, budgets } from '../src/lib/contact.js';

const valid = { firstName: 'Ali', lastName: 'Khan', email: 'ali@example.com', message: 'I need a new website.' };
test('Valid contact fields are accepted', () => assert.deepEqual(validateFields(valid), {}));
test('Missing required fields are identified', () => assert.equal(Object.keys(validateFields({})).length, 4));
test('Email and control-character injection are rejected', () => {
  assert.ok(validateFields({ ...valid, email: 'wrong' }).email);
  assert.ok(validateFields({ ...valid, firstName: 'Ali\nBcc: somebody' }).firstName);
});
test('Short messages, oversized fields and unsafe URLs are rejected', () => {
  assert.ok(validateFields({ ...valid, message: 'short' }).message);
  assert.ok(validateFields({ ...valid, firstName: 'a'.repeat(81) }).firstName);
  for (const website of ['javascript:alert(1)', 'https://user:pass@example.com', 'example.com']) assert.ok(validateFields({ ...valid, website }).website);
  assert.deepEqual(validateFields({ ...valid, website: 'https://example.com' }), {});
});
test('Original quote budget options remain available', () => assert.equal(budgets.length, 9));
