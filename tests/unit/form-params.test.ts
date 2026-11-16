import { expect, it } from 'vitest';
import { flattenParams, type MoodleParam } from '../../src/infrastructure/moodle/form-params.js';

it('flattens scalar params, encoding booleans as 1/0', () => {
  expect(Object.fromEntries(flattenParams({field: 'id', id: 42, enabled: true, disabled: false})))
    .toEqual({field: 'id', id: '42', enabled: '1', disabled: '0'});
});
it('flattens arrays with Moodle numeric brackets', () => {
  expect(Object.fromEntries(flattenParams({values: [42, 43]}))).toEqual({'values[0]': '42', 'values[1]': '43'});
});
it('flattens nested objects and arrays recursively without logging values', () => {
  expect(Object.fromEntries(flattenParams({options: {enabled: false, filters: [{key: 'x', values: [1, true]}]}})))
    .toEqual({'options[enabled]': '0', 'options[filters][0][key]': 'x',
      'options[filters][0][values][0]': '1', 'options[filters][0][values][1]': '1'});
});
it('rejects cycles and ambiguous bracket keys', () => {
  const cycle: Record<string, MoodleParam> = {};
  cycle.self = cycle;
  expect(() => flattenParams(cycle)).toThrow('Invalid operation parameters.');
  expect(() => flattenParams({'wstoken[0]': 'fake'})).toThrow('Invalid operation parameters.');
});
