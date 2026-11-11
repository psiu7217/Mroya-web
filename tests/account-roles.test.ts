import test from 'node:test';
import assert from 'node:assert/strict';

import {hasAccountRole} from '../src/utils/accountRoles.ts';

test('free accounts cannot access premium or admin-only features',()=>{
  assert.equal(hasAccountRole('free','free'),true);
  assert.equal(hasAccountRole('free','premium'),false);
  assert.equal(hasAccountRole('free','admin'),false);
});

test('premium accounts cannot access admin-only features',()=>{
  assert.equal(hasAccountRole('premium','free'),true);
  assert.equal(hasAccountRole('premium','premium'),true);
  assert.equal(hasAccountRole('premium','admin'),false);
});

test('admin product role includes premium and free features',()=>{
  assert.equal(hasAccountRole('admin','free'),true);
  assert.equal(hasAccountRole('admin','premium'),true);
  assert.equal(hasAccountRole('admin','admin'),true);
});

test('missing role is free (safe for staged backend/web deployments)',()=>{
  assert.equal(hasAccountRole(undefined,'free'),true);
  assert.equal(hasAccountRole(undefined,'premium'),false);
  assert.equal(hasAccountRole(undefined,'admin'),false);
});

test('unknown role is treated as free',()=>{
  const unknown = 'future-role' as never;
  assert.equal(hasAccountRole(unknown,'free'),true);
  assert.equal(hasAccountRole(unknown,'admin'),false);
});
