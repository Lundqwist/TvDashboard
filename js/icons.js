// Small inline SVG weather icons (TVs often lack a colour emoji font).
var Icons = (function () {
  var SUN = '<circle cx="32" cy="32" r="11" fill="#ffc94a"/>' +
    [0, 45, 90, 135, 180, 225, 270, 315].map(function (a) {
      return '<rect x="30" y="6" width="4" height="10" rx="2" fill="#ffc94a" transform="rotate(' + a + ' 32 32)"/>';
    }).join('');
  var CLOUD = '<path d="M20 48h26a10 10 0 0 0 0-20 14 14 0 0 0-27-3A11 11 0 0 0 20 48z" fill="#c9d4e6"/>';
  var SMALL_SUN = '<g transform="translate(-8 -10) scale(.8)">' + SUN + '</g>';
  function drops(color) {
    return '<path d="M24 52l-3 7M34 52l-3 7M44 52l-3 7" stroke="' + color + '" stroke-width="3" stroke-linecap="round"/>';
  }
  var FLAKES = '<g fill="#ffffff"><circle cx="23" cy="56" r="2.5"/><circle cx="33" cy="60" r="2.5"/><circle cx="43" cy="56" r="2.5"/></g>';
  var BOLT = '<path d="M34 46l-8 10h6l-3 8 9-11h-6l3-7z" fill="#ffc94a"/>';
  var FOG = '<path d="M14 40h36M18 48h32M14 56h30" stroke="#c9d4e6" stroke-width="4" stroke-linecap="round"/>';

  function svg(body) {
    return '<svg viewBox="0 0 64 64" class="wx-icon" aria-hidden="true">' + body + '</svg>';
  }

  // WMO weather codes, as Open-Meteo returns them.
  function weather(code, isDay) {
    if (code === 0) return svg(isDay === false ? '<path d="M40 14a18 18 0 1 0 12 30A16 16 0 0 1 40 14z" fill="#e8e2c8"/>' : SUN);
    if (code === 1 || code === 2) return svg(SMALL_SUN + CLOUD);
    if (code === 3) return svg(CLOUD);
    if (code === 45 || code === 48) return svg(FOG);
    if (code >= 51 && code <= 67) return svg(CLOUD + drops('#6fb7ff'));
    if (code >= 71 && code <= 77) return svg(CLOUD + FLAKES);
    if (code >= 80 && code <= 82) return svg(SMALL_SUN + CLOUD + drops('#6fb7ff'));
    if (code === 85 || code === 86) return svg(SMALL_SUN + CLOUD + FLAKES);
    if (code >= 95) return svg(CLOUD + BOLT);
    return svg(CLOUD);
  }

  function describe(code) {
    if (code === 0) return 'Clear';
    if (code === 1) return 'Mostly clear';
    if (code === 2) return 'Partly cloudy';
    if (code === 3) return 'Overcast';
    if (code === 45 || code === 48) return 'Fog';
    if (code >= 51 && code <= 57) return 'Drizzle';
    if (code >= 61 && code <= 67) return 'Rain';
    if (code >= 71 && code <= 77) return 'Snow';
    if (code >= 80 && code <= 82) return 'Showers';
    if (code === 85 || code === 86) return 'Snow showers';
    if (code >= 95) return 'Thunderstorm';
    return '';
  }

  return { weather: weather, describe: describe };
})();
