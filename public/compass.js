(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.CompassMath = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  function normalize(deg) {
    const r = ((deg % 360) + 360) % 360;
    return r === 0 ? 0 : r; // collapse -0 → 0
  }

  function computeHeading(event) {
    if (!event) return null;

    if (typeof event.webkitCompassHeading === 'number' && !Number.isNaN(event.webkitCompassHeading)) {
      return { heading: normalize(event.webkitCompassHeading), source: 'ios', absolute: true };
    }

    if (event.alpha == null || Number.isNaN(event.alpha)) {
      return null;
    }

    const heading = normalize(360 - event.alpha);
    const absolute = event.absolute === true;
    return { heading: heading, source: absolute ? 'absolute' : 'relative', absolute: absolute };
  }

  function getDirection(heading) {
    const h = normalize(heading);
    if (h >= 337.5 || h < 22.5) return 'north';
    if (h < 67.5) return 'northeast';
    if (h < 112.5) return 'east';
    if (h < 157.5) return 'southeast';
    if (h < 202.5) return 'south';
    if (h < 247.5) return 'southwest';
    if (h < 292.5) return 'west';
    return 'northwest';
  }

  return { normalize: normalize, computeHeading: computeHeading, getDirection: getDirection };
});
