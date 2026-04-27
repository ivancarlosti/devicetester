import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normalize, computeHeading, shortestRotationDelta, getDirection } = require('../public/compass.js');

test('normalize wraps negatives and >=360 into [0, 360)', () => {
  assert.equal(normalize(0), 0);
  assert.equal(normalize(360), 0);
  assert.equal(normalize(-1), 359);
  assert.equal(normalize(720), 0);
  assert.equal(normalize(-720), 0);
  assert.equal(normalize(450), 90);
});

test('getDirection covers all 8 sectors at boundaries', () => {
  // North wraps across 337.5..22.5
  assert.equal(getDirection(0), 'north');
  assert.equal(getDirection(22.4), 'north');
  assert.equal(getDirection(337.5), 'north');
  assert.equal(getDirection(359.9), 'north');

  assert.equal(getDirection(22.5), 'northeast');
  assert.equal(getDirection(67.4), 'northeast');

  assert.equal(getDirection(67.5), 'east');
  assert.equal(getDirection(112.4), 'east');

  assert.equal(getDirection(112.5), 'southeast');
  assert.equal(getDirection(157.4), 'southeast');

  assert.equal(getDirection(157.5), 'south');
  assert.equal(getDirection(202.4), 'south');

  assert.equal(getDirection(202.5), 'southwest');
  assert.equal(getDirection(247.4), 'southwest');

  assert.equal(getDirection(247.5), 'west');
  assert.equal(getDirection(292.4), 'west');

  assert.equal(getDirection(292.5), 'northwest');
  assert.equal(getDirection(337.4), 'northwest');
});

test('getDirection normalizes negative and out-of-range input', () => {
  assert.equal(getDirection(-1), 'north');     // 359
  assert.equal(getDirection(-90), 'west');     // 270
  assert.equal(getDirection(450), 'east');     // 90
});

test('computeHeading prefers webkitCompassHeading when defined', () => {
  const r = computeHeading({ webkitCompassHeading: 90, alpha: 42, absolute: false });
  assert.equal(r.heading, 90);
  assert.equal(r.source, 'ios');
  assert.equal(r.absolute, true);
});

test('computeHeading uses 360-alpha for absolute (Android) events', () => {
  const r = computeHeading({ absolute: true, alpha: 90 });
  assert.equal(r.heading, 270);
  assert.equal(r.source, 'absolute');
  assert.equal(r.absolute, true);
});

test('computeHeading flags relative events when absolute is false/missing', () => {
  const r = computeHeading({ absolute: false, alpha: 90 });
  assert.equal(r.heading, 270);
  assert.equal(r.source, 'relative');
  assert.equal(r.absolute, false);

  const r2 = computeHeading({ alpha: 0 });
  assert.equal(r2.heading, 0);
  assert.equal(r2.source, 'relative');
});

test('computeHeading returns null when alpha is null/missing and no webkit value', () => {
  assert.equal(computeHeading({ alpha: null, absolute: true }), null);
  assert.equal(computeHeading({}), null);
  assert.equal(computeHeading(null), null);
});

test('computeHeading wraps alpha=0 to heading=0 (not 360)', () => {
  const r = computeHeading({ absolute: true, alpha: 0 });
  assert.equal(r.heading, 0);
});

test('computeHeading ignores NaN webkitCompassHeading and falls back to alpha', () => {
  const r = computeHeading({ webkitCompassHeading: Number.NaN, absolute: true, alpha: 45 });
  assert.equal(r.heading, 315);
  assert.equal(r.source, 'absolute');
});

test('shortestRotationDelta picks the short way for small CW/CCW steps', () => {
  assert.equal(shortestRotationDelta(0, 1), 1);
  assert.equal(shortestRotationDelta(0, -1), -1);
  assert.equal(shortestRotationDelta(10, 20), 10);
  assert.equal(shortestRotationDelta(20, 10), -10);
});

test('shortestRotationDelta unwraps across 0°/360° to a 2° step (the bug we are fixing)', () => {
  // Going from -1° (≈ 359°) accumulated rotation to a target of -359° (≈ 1°)
  // would naively be a +358° change; the helper must return -2° (or +2°).
  assert.equal(shortestRotationDelta(-1, -359), 2);
  assert.equal(shortestRotationDelta(-359, -1), -2);
  // Same idea expressed as positive headings.
  assert.equal(shortestRotationDelta(359, 1), 2);
  assert.equal(shortestRotationDelta(1, 359), -2);
});

test('shortestRotationDelta keeps result in [-180, 180] and lands on target', () => {
  for (let from = -720; from <= 720; from += 37) {
    for (let to = -720; to <= 720; to += 41) {
      const d = shortestRotationDelta(from, to);
      assert.ok(d >= -180 && d <= 180, `delta out of range for ${from}→${to}: ${d}`);
      // (from + d) and `to` must point at the same compass position mod 360.
      assert.equal(normalize(from + d), normalize(to));
    }
  }
});

test('shortestRotationDelta handles 180° antipodes consistently', () => {
  // 180° away — either direction is equally short. Implementation picks -180,
  // but accumulating it must still land at the right compass position.
  const d = shortestRotationDelta(0, 180);
  assert.ok(d === 180 || d === -180);
  assert.equal(normalize(0 + d), 180);
});

test('accumulated rotation across a full revolution stays drift-free', () => {
  // Simulate the needle being driven through every degree 0..360..0 and verify
  // the accumulated rotation always corresponds to the input heading mod 360.
  let acc = 0;
  for (let h = 0; h < 720; h++) {
    acc += shortestRotationDelta(acc, -h);
    assert.equal(normalize(-acc), h % 360);
  }
});
