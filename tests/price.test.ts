import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractPrice } from '../src/utils/price.ts';

test('NT$ with thousands separator', () => {
  assert.deepEqual(extractPrice('Desk lamp NT$1,290 free shipping'), { amount: 1290, label: 'NT$1,290' });
});
test('first currency amount wins', () => {
  assert.deepEqual(extractPrice('原價 NT$2,450 特價 NT$1,990'), { amount: 2450, label: 'NT$2,450' });
});
test('trailing 元', () => {
  assert.deepEqual(extractPrice('售價 990 元'), { amount: 990, label: '990 元' });
});
test('decimals and US$', () => {
  assert.deepEqual(extractPrice('Now US$ 19.99'), { amount: 19.99, label: 'US$ 19.99' });
});
test('full-width dollar sign', () => {
  assert.deepEqual(extractPrice('＄350'), { amount: 350, label: '＄350' });
});
test('no currency marker returns null', () => {
  assert.equal(extractPrice('Model 2024 with 3 modes'), null);
});
