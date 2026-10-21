/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { letterList } from '../src/components/drill/letters';

describe('the letters a "not quite" points to', () => {
  it('names one target', () => assert.equal(letterList([2]), 'C'));
  it('joins two with "and"', () => assert.equal(letterList([1, 3]), 'B and D'));
  it('lists three', () => assert.equal(letterList([0, 1, 3]), 'A, B and D'));
  it('is empty for a drill with no target', () => assert.equal(letterList([]), ''));
});
