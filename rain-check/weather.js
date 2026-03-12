document.addEventListener('DOMContentLoaded', () => {
  /**
   * =========================================================
   * DOM REFERENCES
   * Lahat ng UI elements na ginagamit at ina-update ng page
   * =========================================================
   */
  const placeInput = document.getElementById('placeInput');
  const searchBtn = document.getElementById('searchBtn');
  const currentLocationBtn = document.getElementById('currentLocationBtn');
  const suggestionsBox = document.getElementById('suggestionsBox');

  const loadingState = document.getElementById('loadingState');
  const errorState = document.getElementById('errorState');

  const summaryPill = document.getElementById('summaryPill');
  const locationTitle = document.getElementById('locationTitle');
  const bigAnswer = document.getElementById('bigAnswer');
  const mainExplanation = document.getElementById('mainExplanation');
  const tempValue = document.getElementById('tempValue');
  const rainValue = document.getElementById('rainValue');
  const windValue = document.getElementById('windValue');
  const updatedValue = document.getElementById('updatedValue');
  const summaryEmoji = document.getElementById('summaryEmoji');
  const readingGuide = document.getElementById('readingGuide');
  const hourlyList = document.getElementById('hourlyList');

  const timelineMeta = document.getElementById('timelineMeta');
  const timelineTime = document.querySelector('.timeline-time');
  const timelinePlace = document.querySelector('.timeline-place');

  const goOutArt = document.getElementById('goOutArt');
  const laundryArt = document.getElementById('laundryArt');
  const goOutImage = document.getElementById('goOutImage');
  const laundryImage = document.getElementById('laundryImage');

  const goOutTitle = document.getElementById('goOutTitle');
  const goOutText = document.getElementById('goOutText');
  const laundryTitle = document.getElementById('laundryTitle');
  const laundryText = document.getElementById('laundryText');
  const bringList = document.getElementById('bringList');
  const laundryList = document.getElementById('laundryList');

  const smartGoOut = document.getElementById('smartGoOut');
  const smartUmbrella = document.getElementById('smartUmbrella');
  const smartDrying = document.getElementById('smartDrying');
  const smartLaundry = document.getElementById('smartLaundry');

  /**
   * =========================================================
   * INTERNAL STATE
   * =========================================================
   */
  let latestWeatherBundle = null;
  let activeTimeIndex = -1;
  let selectedSuggestion = null;
  let suggestionResults = [];
  let suggestionDebounce = null;

  /**
   * =========================================================
   * WEATHER LABELS
   * Open-Meteo weather code -> readable label
   * =========================================================
   */
  const WEATHER_LABELS = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Foggy',
    51: 'Light drizzle',
    53: 'Drizzle',
    55: 'Dense drizzle',
    56: 'Freezing drizzle',
    57: 'Freezing drizzle',
    61: 'Light rain',
    63: 'Rain',
    65: 'Heavy rain',
    66: 'Freezing rain',
    67: 'Freezing rain',
    80: 'Rain showers',
    81: 'Rain showers',
    82: 'Strong rain showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with hail',
    99: 'Strong thunderstorm'
  };

  /**
   * =========================================================
   * WEATHER IMAGE MAP
   * Per weather category, may image para sa go-out at laundry
   * =========================================================
   */
  const WEATHER_IMAGES = {
    clear: {
      goOut: '/rain-check/weather-images/clear-go-out.webp',
      laundry: '/rain-check/weather-images/clear-laundry.webp'
    },
    partlyCloudy: {
      goOut: '/rain-check/weather-images/partly-cloudy-go-out.webp',
      laundry: '/rain-check/weather-images/partly-cloudy-laundry.webp'
    },
    overcast: {
      goOut: '/rain-check/weather-images/overcast-go-out.webp',
      laundry: '/rain-check/weather-images/overcast-laundry.webp'
    },
    lightRain: {
      goOut: '/rain-check/weather-images/light-rain-go-out.webp',
      laundry: '/rain-check/weather-images/light-rain-laundry.webp'
    },
    moderateRain: {
      goOut: '/rain-check/weather-images/moderate-rain-go-out.webp',
      laundry: '/rain-check/weather-images/moderate-rain-laundry.webp'
    },
    heavyRain: {
      goOut: '/rain-check/weather-images/heavy-rain-go-out.webp',
      laundry: '/rain-check/weather-images/heavy-rain-laundry.webp'
    },
    thunderstorm: {
      goOut: '/rain-check/weather-images/thunderstorm-go-out.webp',
      laundry: '/rain-check/weather-images/thunderstorm-laundry.webp'
    },
    typhoon: {
      goOut: '/rain-check/weather-images/typhoon-go-out.webp',
      laundry: '/rain-check/weather-images/typhoon-laundry.webp'
    }
  };

  /**
   * =========================================================
   * LOCAL PH SEARCH BOOST
   * Para sure na gumana ang common PH landmarks/areas
   * =========================================================
   */
  const LOCAL_PH_ALIASES = [
    { name: 'UP Diliman', admin1: 'Quezon City', latitude: 14.6537, longitude: 121.0684, kind: 'University', keywords: ['up diliman', 'upd', 'university of the philippines diliman'] },
    { name: 'Cubao', admin1: 'Quezon City', latitude: 14.6197, longitude: 121.0538, kind: 'District', keywords: ['cubao', 'araneta city', 'araneta'] },
    { name: 'EDSA', admin1: 'Metro Manila', latitude: 14.5869, longitude: 121.0567, kind: 'Road', keywords: ['edsa', 'epifanio de los santos avenue'] },
    { name: 'MRT Quezon Ave', admin1: 'Quezon City', latitude: 14.6427, longitude: 121.0381, kind: 'Transit Station', keywords: ['mrt quezon ave', 'quezon ave mrt', 'quezon avenue mrt'] },
    { name: 'Divisoria', admin1: 'Manila', latitude: 14.6023, longitude: 120.9719, kind: 'District', keywords: ['divisoria'] },
    { name: 'Greenhills', admin1: 'San Juan', latitude: 14.6044, longitude: 121.0478, kind: 'District', keywords: ['greenhills', 'greenhills shopping center'] },
    { name: 'BGC High Street', admin1: 'Taguig', latitude: 14.5509, longitude: 121.0506, kind: 'Landmark', keywords: ['bgc high street', 'bonifacio high street', 'high street bgc'] },
    { name: 'SM North EDSA', admin1: 'Quezon City', latitude: 14.6568, longitude: 121.0301, kind: 'Mall', keywords: ['sm north', 'sm north edsa'] },
    { name: 'Barangay Holy Spirit', admin1: 'Quezon City', latitude: 14.6857, longitude: 121.0805, kind: 'Barangay', keywords: ['barangay holy spirit', 'holy spirit quezon city', 'holy spirit'] },
    { name: 'Lucky Chinatown Mall', admin1: 'Manila', latitude: 14.6030, longitude: 120.9748, kind: 'Mall', keywords: ['lucky chinatown', 'lucky chinatown mall', 'chinatown mall manila'] }
  ];

  /**
   * =========================================================
   * UI HELPERS
   * =========================================================
   */
  function setLoading(isLoading) {
    if (loadingState) loadingState.classList.toggle('hidden', !isLoading);
    if (searchBtn) searchBtn.disabled = isLoading;
    if (currentLocationBtn) currentLocationBtn.disabled = isLoading;
  }

  function setError(message = '') {
    if (!errorState) return;
    errorState.textContent = message;
    errorState.classList.toggle('hidden', !message);
  }

  /**
   * =========================================================
   * INPUT NORMALIZER
   * =========================================================
   */
  function normalizePlaceName(value) {
    return `${value || ''}`.replace(/\s+/g, ' ').trim();
  }

  /**
   * =========================================================
   * ESCAPE HTML
   * =========================================================
   */
  function escapeHtml(value = '') {
    return `${value}`
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * =========================================================
   * REGION LABEL SHORTENER
   * =========================================================
   */
  function shortRegionLabel(admin1 = '') {
    const value = `${admin1}`.trim();

    if (value === 'National Capital Region') return 'NCR';
    if (value === 'Cordillera Administrative Region') return 'CAR';
    if (value === 'Bangsamoro Autonomous Region in Muslim Mindanao') return 'BARMM';
    if (value === 'Metro Manila') return 'NCR';

    return value;
  }

  /**
   * =========================================================
   * PH COORDINATE FILTER
   * Rough PH bounds para ma-ignore ang outside PH
   * =========================================================
   */
  function isLikelyPhilippines(latitude, longitude) {
    return latitude >= 4 && latitude <= 22 && longitude >= 116 && longitude <= 127;
  }

  /**
   * =========================================================
   * WEATHER GROUP
   * Broad visual group para sa overall page mood
   * =========================================================
   */
  function weatherGroup(code, rainNow) {
    if ([95, 96, 99].includes(code)) return 'storm';
    if (rainNow > 0 || [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rain';
    if ([1, 2, 3, 45, 48].includes(code)) return 'cloudy';
    return 'clear';
  }

  /**
   * =========================================================
   * DETAILED WEATHER CATEGORY
   * =========================================================
   */
  function getWeatherCategory(snapshot, upcomingProbabilities = []) {
    const code = Number(snapshot.weather_code || 0);
    const rainNow = Number(snapshot.rain || 0);
    const wind = Number(snapshot.wind_speed_10m || 0);
    const nextThreeProb = upcomingProbabilities.length ? Math.max(...upcomingProbabilities) : 0;

    if (wind >= 62) return 'typhoon';
    if ([95, 96, 99].includes(code)) return 'thunderstorm';

    if (rainNow >= 7.5 || code === 65 || code === 82) return 'heavyRain';
    if (rainNow >= 2.5 || code === 63 || code === 81) return 'moderateRain';
    if (rainNow > 0 || [51, 53, 55, 61, 80].includes(code) || nextThreeProb >= 70) return 'lightRain';

    if (code === 3 || [45, 48].includes(code)) return 'overcast';
    if ([1, 2].includes(code)) return 'partlyCloudy';

    return 'clear';
  }

  /**
   * =========================================================
   * WEATHER EMOJI
   * =========================================================
   */
  function weatherEmojiFor(group, code) {
    if (group === 'storm') return '⛈️';
    if (group === 'rain') return [80, 81, 82].includes(code) ? '🌦️' : '🌧️';
    if (group === 'cloudy') return [1, 2].includes(code) ? '⛅' : '☁️';
    return '☀️';
  }

  /**
   * =========================================================
   * TIME FORMATTERS
   * =========================================================
   */
  function formatTime(iso, timezone = 'Asia/Manila') {
    return new Intl.DateTimeFormat('en-PH', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone
    }).format(new Date(iso));
  }

  function formatUpdated(iso, timezone = 'Asia/Manila') {
    return new Intl.DateTimeFormat('en-PH', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone
    }).format(new Date(iso));
  }
  /**
 * =========================================================
 * FORMAT CURRENT TIME LABEL
 * Generates "Now • 7:12 AM" style label
 * =========================================================
 */
function formatNowLabel(date = new Date()) {
  try {
    return `Now • ${date.toLocaleTimeString('en-PH', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })}`;
  } catch {
    return 'Now';
  }
}

  

  /**
   * =========================================================
   * WEATHER TEXT
   * =========================================================
   */
  function weatherText(code) {
    return WEATHER_LABELS[code] || 'Weather update';
  }

  /**
   * =========================================================
   * PAGE MOOD APPLIER
   * =========================================================
   */
  function applyPageMood(group) {
    document.body.classList.remove('weather-clear', 'weather-cloudy', 'weather-rain', 'weather-storm');
    document.body.classList.add(`weather-${group}`);

    if (goOutArt) {
      goOutArt.classList.remove('art-clear', 'art-cloudy', 'art-rain', 'art-storm');
      goOutArt.classList.add(`art-${group}`);
    }

    if (laundryArt) {
      laundryArt.classList.remove('art-clear', 'art-cloudy', 'art-rain', 'art-storm');
      laundryArt.classList.add(`art-${group}`);
    }
  }

  /**
   * =========================================================
   * IMAGE SWITCHER
   * =========================================================
   */
  function updateAdviceImages(category) {
    const selected = WEATHER_IMAGES[category] || WEATHER_IMAGES.partlyCloudy;

    if (goOutImage) goOutImage.src = selected.goOut;
    if (laundryImage) laundryImage.src = selected.laundry;
  }

  /**
   * =========================================================
   * SUMMARY TEXT BUILDER
   * Gumagawa ng pangunahing sagot kung umuulan ba o hindi
   * =========================================================
   */
  function summarizeRain(place, group, rainNow, currentProb) {
    if (group === 'storm') {
      return {
        answer: 'Oo, delikado ang weather ngayon.',
        explanation: `May thunderstorm-type conditions ngayon sa ${place}. Hindi lang ito simpleng ulan, so better mag-ingat sa travel at outdoor plans.`
      };
    }

    if (rainNow > 0) {
      const intensity = rainNow >= 2.5 ? 'malakas-lakas' : rainNow >= 1 ? 'katamtaman' : 'mahina';
      return {
        answer: 'Oo, umuulan ngayon.',
        explanation: `Base sa latest reading, may ${intensity} na ulan ngayon sa ${place}. Medyo wise na mag-ready sa basa at possible na madulas na daan.`
      };
    }

    if (currentProb >= 60) {
      return {
        answer: 'Hindi pa buhos ngayon, pero mataas ang chance ng ulan.',
        explanation: `Sa current reading, puwedeng wala pang direct rain amount sa ${place}, pero mukhang paulan na base sa short forecast.`
      };
    }

    if (group === 'cloudy') {
      return {
        answer: 'Wala pang ulan sa ngayon.',
        explanation: `Makulimlim ang weather sa ${place}, pero sa latest reading ay wala pang active rain ngayon. Puwede pa rin itong magbago later.`
      };
    }

    return {
      answer: 'Hindi, walang ulan sa ngayon.',
      explanation: `Sa latest weather data para sa ${place}, clear o mostly okay ang panahon at walang na-detect na ulan sa oras ng check.`
    };
  }

  /**
   * =========================================================
   * GOING OUT ADVICE
   * Advice para sa paglabas
   * =========================================================
   */
  function getGoOutAdvice(category, temp, wind, nextThreeProb) {
    if (category === 'typhoon') {
      return {
        title: 'Stay indoors hangga’t maaari',
        text: 'Sobrang lakas ng hangin at ulan, so unsafe ang unnecessary travel ngayon.',
        items: [
          'Huwag nang lumabas unless emergency.',
          'I-charge ang phone at ihanda ang essentials sakaling mawalan ng kuryente.',
          'Iwasan ang baha, open roads, at areas na may bumabagsak na debris.'
        ]
      };
    }

    if (category === 'thunderstorm') {
      return {
        title: 'Kung hindi urgent, better na i-delay muna ang labas',
        text: 'May thunderstorm vibe ngayon. Kung lalabas ka talaga, priority ang safety kaysa comfort.',
        items: [
          'Magdala ng matibay na payong o rain jacket, pero tandaan na hindi safe ang payong sa sobrang lakas ng hangin at kidlat.',
          'Iwasan ang open areas at mag-ready sa possible delays sa biyahe.',
          'Mas okay ang waterproof shoes o tsinelas na may kapit kaysa madulas na footwear.'
        ]
      };
    }

    if (category === 'heavyRain') {
      return {
        title: 'Lumalabas lang kung kailangan talaga',
        text: 'Malakas ang ulan ngayon, kaya mas okay kung iiwas muna sa unnecessary trips.',
        items: [
          'Magdala ng malaking payong o rain jacket.',
          'I-expect ang possible baha o mabagal na biyahe.',
          'Waterproof footwear at protected gadgets are a must.'
        ]
      };
    }

    if (category === 'moderateRain') {
      return {
        title: 'Pwede lumabas, pero prepared ka dapat',
        text: 'Tuloy-tuloy ang ulan ngayon o mukhang tuloy-tuloy sa susunod na oras.',
        items: [
          'Magdala ng payong o lightweight raincoat.',
          temp >= 31
            ? 'Mainit pa rin kahit maulan, so breathable clothes pa rin ang best.'
            : 'Mas okay ang extra layer or pamalit kung mababasa ka.',
          wind >= 20
            ? 'May hangin din, so secure your bag at iwas sa sobrang gaan na payong.'
            : 'Lagyan ng protection ang gadgets at important papers.'
        ]
      };
    }

    if (category === 'lightRain') {
      return {
        title: 'Pwede lumabas, pero rain-ready ka dapat',
        text: 'May ambon o mataas ang chance ng ulan sa next hours, kaya mas okay kung prepared ka bago umalis.',
        items: [
          'Magdala ng compact umbrella o light rain jacket.',
          temp >= 31
            ? 'Piliin ang preskong suot kahit may chance ng ulan.'
            : 'Okay ang regular outfit, pero better kung mabilis matuyo ang tela.',
          'Mag-ingat sa basa at madulas na daan.'
        ]
      };
    }

    if (category === 'overcast') {
      return {
        title: 'Okay lumabas, pero magbaon pa rin ng backup',
        text: 'Hindi pa umuulan ngayon, pero mabigat ang ulap at puwedeng magbago ang weather.',
        items: [
          'Compact umbrella is a good idea just in case.',
          'Normal outfit is okay, pero iwas sa sobrang hirap patuyuin na tela.',
          'Check ulit bago umuwi dahil puwedeng mag-shift ang weather later.'
        ]
      };
    }

    if (category === 'partlyCloudy') {
      return {
        title: 'Okay pa lumabas, pero may konting paghahanda',
        text: 'Hindi pa naman mukhang delikado ang weather, pero may chance pa ring mag-shift mamaya.',
        items: [
          'Optional ang payong, pero useful kung matagal ka sa labas.',
          temp >= 32 ? 'Mainit-init pa rin, so tubig at breathable clothes ang best.' : 'Regular clothes should be fine.',
          'Good time para sa errands, commute, o quick cafe run.'
        ]
      };
    }

    return {
      title: 'Good time lumabas',
      text: 'Mukhang okay ang weather ngayon at mababa ang chance ng ulan in the short term.',
      items: [
        'Hindi priority ang payong, pero okay pa rin kung gusto mo ng backup.',
        temp >= 32 ? 'Mainit ang panahon, so tubig at light clothes ang best dala.' : 'Comfortable clothes and regular shoes should be fine.',
        nextThreeProb >= 40
          ? 'May konting chance ng ulan later, so check ulit bago umalis nang matagal.'
          : 'Mas convenient ito for errands, short trips, or quick cafe runs.'
      ]
    };
  }

  /**
   * =========================================================
   * LAUNDRY ADVICE
   * Advice para sa paglalaba at pagpapatuyo
   * =========================================================
   */
  function getLaundryAdvice(category, wind, temp) {
    if (category === 'typhoon') {
      return {
        title: 'Unsafe ang outdoor laundry ngayon',
        text: 'Powerful storm conditions ito, so hindi practical at hindi safe ang anumang outdoor drying.',
        items: [
          'Huwag magsampay sa labas.',
          'Kung may labada ka, keep everything indoors.',
          'Mas okay ipagpaliban ang full laundry load hanggang maging stable ang panahon.'
        ]
      };
    }

    if (category === 'thunderstorm') {
      return {
        title: 'Not recommended maglaba at magsampay ngayon',
        text: 'Thunderstorm conditions mean mataas ang risk na hindi matuyo ang labada at baka mabasa pa lalo.',
        items: [
          'Kung maglalaba ka man, indoor drying lang ang safe option.',
          'Huwag magsampay sa open area habang may kulog, kidlat, o malakas na hangin.',
          'Mas practical i-move ang full laundry load sa mas stable na oras.'
        ]
      };
    }

    if (category === 'heavyRain') {
      return {
        title: 'Bad timing para sa outdoor drying',
        text: 'Malakas ang ulan ngayon, kaya halos siguradong hindi matutuyo ang isasampay mo sa labas.',
        items: [
          'Huwag magsampay sa open space.',
          'Indoor sampayan o dryer lang ang practical ngayon.',
          'Expect slow drying kung walang maayos na airflow sa loob.'
        ]
      };
    }

    if (category === 'moderateRain') {
      return {
        title: 'Pwede maglaba, pero risky magsampay sa labas',
        text: 'Maulan na o mataas ang chance na tuloy-tuloy ang ulan, kaya hindi ideal ang outdoor drying.',
        items: [
          'Okay ang laba kung may indoor sampayan o dryer.',
          'Kung outdoor lang ang option mo, mas mabuting ipagpaliban muna.',
          temp >= 31 && wind >= 10
            ? 'May konting drying help from init at hangin, pero ulan pa rin ang deciding factor.'
            : 'Expect na mabagal ang pagpapatuyo ng damit.'
        ]
      };
    }

    if (category === 'lightRain') {
      return {
        title: 'Hindi ideal ang magsampay sa labas ngayon',
        text: 'May ambon o malapit na ang ulan, kaya alanganin ang outdoor drying.',
        items: [
          'Pwede maglaba kung may indoor drying setup ka.',
          'Huwag magbilad ng malaking load sa labas.',
          'Mas safe ang small indoor batch kaysa full outdoor sampay.'
        ]
      };
    }

    if (category === 'overcast') {
      return {
        title: 'Pwede, pero medyo sugal ang pagsampay sa labas',
        text: 'Hindi pa umuulan ngayon, pero makulimlim at puwedeng magbago ang panahon.',
        items: [
          'Small laundry load is safer kaysa sobrang dami.',
          'Mas okay kung maaga magsampay at may backup kang masisilungan.',
          'Check ulit after 1 to 2 hours para hindi maabutan ng ulan.'
        ]
      };
    }

    if (category === 'partlyCloudy') {
      return {
        title: 'Pwede maglaba at pwede rin magsampay, pero bantayan pa rin',
        text: 'Okay pa ang weather ngayon, pero may konting risk na magbago later.',
        items: [
          'Good for light to medium laundry load.',
          'Mas okay kung may araw at may hangin sa area mo.',
          'Mag-check ulit later lalo na kung iiwan ang damit sa labas nang matagal.'
        ]
      };
    }

    return {
      title: 'Good chance para maglaba at magsampay',
      text: 'Sa current weather at short forecast, ito ang pinaka-safe window para sa labada.',
      items: [
        'Okay magsampay sa labas kung may direct airflow at decent sunlight.',
        wind >= 10
          ? 'May enough hangin para makatulong sa pagpapatuyo.'
          : 'Hindi sobrang mahangin, pero okay pa rin kung maaraw at hindi maulan.',
        temp >= 31
          ? 'Samantalahin ang init dahil mas mabilis matuyo ang damit.'
          : 'Bantayan pa rin ang next update kahit maganda ang forecast ngayon.'
      ]
    };
  }

  /**
   * =========================================================
   * LIST RENDERER
   * =========================================================
   */
  function renderList(target, items) {
    if (!target) return;
    target.innerHTML = items.map(item => `<li>${escapeHtml(item)}</li>`).join('');
  }

  /**
   * =========================================================
   * UPCOMING PROBABILITIES
   * =========================================================
   */
  function getUpcomingProbabilities(hourly, startIndex, count = 3) {
    return (hourly.precipitation_probability || [])
      .slice(startIndex, startIndex + count)
      .map(value => Number(value || 0));
  }

  /**
   * =========================================================
   * SNAPSHOT BUILDER
   * =========================================================
   */
  function buildSelectedSnapshot(bundle, index) {
    const { weather } = bundle;
    const { current, hourly } = weather;

    if (index === -1) {
      return {
        label: 'Now',
        time: current.time,
        weather_code: Number(current.weather_code || 0),
        rain: Number(current.rain || 0),
        temperature_2m: Number(current.temperature_2m || 0),
        wind_speed_10m: Number(current.wind_speed_10m || 0),
        currentProbability: Math.round(hourly.precipitation_probability?.[0] || 0),
        nextThreeProbabilities: getUpcomingProbabilities(hourly, 0, 3)
      };
    }

    return {
      label: formatTime(hourly.time[index], weather.timezone),
      time: hourly.time[index],
      weather_code: Number(hourly.weather_code[index] || 0),
      rain: Number(hourly.precipitation[index] || 0),
      temperature_2m: Number(hourly.temperature_2m?.[index] || current.temperature_2m || 0),
      wind_speed_10m: Number(hourly.wind_speed_10m?.[index] || current.wind_speed_10m || 0),
      currentProbability: Math.round(hourly.precipitation_probability?.[index] || 0),
      nextThreeProbabilities: getUpcomingProbabilities(hourly, index, 3)
    };
  }

  /**
   * =========================================================
   * SMART ENGINE STATE
   * Quick yes/no style output para sa compact smart card
   * =========================================================
   */
  function getSmartEngineState(category) {
    if (category === 'typhoon') {
      return {
        goOut: 'NO',
        umbrella: 'NO',
        drying: 'NO',
        laundry: 'NOT RECOMMENDED'
      };
    }

    if (category === 'thunderstorm') {
      return {
        goOut: 'NO',
        umbrella: 'YES',
        drying: 'NO',
        laundry: 'INDOOR ONLY'
      };
    }

    if (category === 'heavyRain') {
      return {
        goOut: 'LIMITED',
        umbrella: 'YES',
        drying: 'NO',
        laundry: 'INDOOR ONLY'
      };
    }

    if (category === 'moderateRain' || category === 'lightRain') {
      return {
        goOut: 'YES',
        umbrella: 'YES',
        drying: 'NO',
        laundry: 'OK, INDOOR DRYING'
      };
    }

    if (category === 'overcast') {
      return {
        goOut: 'YES',
        umbrella: 'OPTIONAL',
        drying: 'RISKY',
        laundry: 'YES, BUT WATCH THE SKY'
      };
    }

    return {
      goOut: 'YES',
      umbrella: 'OPTIONAL',
      drying: 'YES',
      laundry: 'YES'
    };
  }

  /**
   * =========================================================
   * MAIN RENDER FUNCTION
   * =========================================================
   */
  function renderSelectedTime(index) {
    if (!latestWeatherBundle) return;

    activeTimeIndex = index;

    const { geo, weather, fallbackNote } = latestWeatherBundle;
    const placeName = [geo.name, geo.admin1].filter(Boolean).join(', ');
    const shortPlaceName = [geo.name, shortRegionLabel(geo.admin1)].filter(Boolean).join(', ');
    const snapshot = buildSelectedSnapshot(latestWeatherBundle, index);

    const rainNow = Number(snapshot.rain || 0);
    const temp = Number(snapshot.temperature_2m || 0);
    const wind = Number(snapshot.wind_speed_10m || 0);
    const currentProb = Number(snapshot.currentProbability || 0);
    const nextThreeProb = snapshot.nextThreeProbabilities.length
      ? Math.max(...snapshot.nextThreeProbabilities)
      : 0;

    const group = weatherGroup(snapshot.weather_code, rainNow);
    const category = getWeatherCategory(snapshot, snapshot.nextThreeProbabilities);

    const summary = summarizeRain(placeName, group, rainNow, currentProb);
    const goOut = getGoOutAdvice(category, temp, wind, nextThreeProb);
    const laundry = getLaundryAdvice(category, wind, temp);
    const smartState = getSmartEngineState(category);

    if (summaryPill) {
      summaryPill.textContent = index === -1
        ? `📍 ${placeName}`
        : `📍 ${placeName} • ${snapshot.label}`;
    }

    if (timelineTime && timelinePlace) {
      timelineTime.textContent = snapshot.label;
      timelinePlace.textContent = shortPlaceName;
    } else if (timelineMeta) {
      timelineMeta.textContent = `${snapshot.label} • ${shortPlaceName}`;
    }

    if (locationTitle) locationTitle.textContent = placeName;
    if (bigAnswer) bigAnswer.textContent = summary.answer;

    if (mainExplanation) {
      let explanationText = `${summary.explanation} Selected time: ${snapshot.label}. Condition: ${weatherText(snapshot.weather_code)}.`;

      if (fallbackNote && index === -1) {
        explanationText += ` ${fallbackNote}`;
      }

      mainExplanation.textContent = explanationText;
    }

    if (tempValue) tempValue.textContent = `${Math.round(temp)}°C`;
    if (rainValue) rainValue.textContent = `${rainNow.toFixed(1)} mm`;
    if (windValue) windValue.textContent = `${Math.round(wind)} km/h`;
    if (updatedValue) updatedValue.textContent = formatUpdated(snapshot.time, weather.timezone);
    if (summaryEmoji) summaryEmoji.textContent = weatherEmojiFor(group, snapshot.weather_code);

    if (readingGuide) {
      readingGuide.textContent = index === -1
        ? 'Ang current view ay base sa latest current weather plus short forecast. Maaari mong i-click ang ibang oras sa “Weather timeline” para makita ang projected advice at status sa oras na iyon.'
        : `Ang current view ay naka-base sa selected time na ${snapshot.label}. Kaya ang advice, images, at status ay naka-sync sa oras na pinili mo.`;
    }

    if (goOutTitle) goOutTitle.textContent = goOut.title;
    if (goOutText) goOutText.textContent = goOut.text;
    if (laundryTitle) laundryTitle.textContent = laundry.title;
    if (laundryText) laundryText.textContent = laundry.text;

    renderList(bringList, goOut.items);
    renderList(laundryList, laundry.items);

    if (smartGoOut) smartGoOut.textContent = smartState.goOut;
    if (smartUmbrella) smartUmbrella.textContent = smartState.umbrella;
    if (smartDrying) smartDrying.textContent = smartState.drying;
    if (smartLaundry) smartLaundry.textContent = smartState.laundry;

    applyPageMood(group);
    updateAdviceImages(category);
    renderHourly(weather.hourly, weather.timezone, index);
  }

/**
 * =========================================================
 * HOURLY RENDERER
 * Gumagawa ng clickable current + next 5 future hourly rows
 * Current row = actual current time
 * Next rows = first future hour onward
 * =========================================================
 */
function renderHourly(hourly, timezone, selectedIndex = -1) {
  if (!hourlyList || !hourly || !Array.isArray(hourly.time)) return;
  if (!latestWeatherBundle?.weather?.current?.time) return;

  const currentIso = latestWeatherBundle.weather.current.time;
  const currentDate = new Date(currentIso);

  /**
   * Current row uses actual current weather
   * Future rows should start at the first hourly slot STRICTLY AFTER current time
   */
  let nextStartIndex = hourly.time.findIndex(time => {
    return new Date(time) > currentDate;
  });

  if (nextStartIndex === -1) nextStartIndex = 0;

  const visibleTimes = hourly.time.slice(nextStartIndex, nextStartIndex + 5);

  /**
   * Current row uses actual current weather values
   */
  const currentRain = Number(latestWeatherBundle.weather.current.rain || 0);

  /**
   * Use nearest future probability as a visual estimate for current row bar
   * kung wala, fallback to 0
   */
  const currentProbability = Math.max(
    0,
    Math.min(100, Math.round(hourly.precipitation_probability?.[nextStartIndex] || 0))
  );

  const currentRow = `
    <button class="hour-row current-row ${selectedIndex === -1 ? 'active' : ''}" type="button" data-time-index="-1">
      <div class="hour-time-label now-label">${formatNowLabel()}</div>
      <div class="hour-bar"><span style="width:${currentProbability}%"></span></div>
      <div>${currentRain.toFixed(1)} mm</div>
    </button>
  `;

  const rows = visibleTimes.map((time, visibleIndex) => {
    const actualIndex = nextStartIndex + visibleIndex;

    const probability = Math.max(
      0,
      Math.min(100, Math.round(hourly.precipitation_probability?.[actualIndex] || 0))
    );

    const amount = Number(hourly.precipitation?.[actualIndex] || 0);

    return `
      <button class="hour-row ${selectedIndex === actualIndex ? 'active' : ''}" type="button" data-time-index="${actualIndex}">
        <div class="hour-time-label">${formatTime(time, timezone)}</div>
        <div class="hour-bar"><span style="width:${probability}%"></span></div>
        <div>${amount.toFixed(1)} mm</div>
      </button>
    `;
  }).join('');

  hourlyList.innerHTML = currentRow + rows;

  hourlyList.querySelectorAll('.hour-row').forEach(button => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.timeIndex);
      renderSelectedTime(index);
    });
  });
}
  
/**
 * =========================================================
 * PHOTON SUGGESTION NORMALIZER
 * OSM/Photon result -> clean UI suggestion
 * Inaayos ang street / brgy / landmark / city labels
 * =========================================================
 */
function normalizePhotonFeature(item) {
  const p = item?.properties || {};
  const coords = item?.geometry?.coordinates || [];

  const longitude = Number(coords[0]);
  const latitude = Number(coords[1]);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (!isLikelyPhilippines(latitude, longitude)) return null;

  /* -----------------------------------------
     Build readable primary label
     Priority:
     landmark -> street -> suburb/brgy -> district -> city
     ----------------------------------------- */
  const houseAndStreet =
    p.housenumber && p.street
      ? `${p.housenumber} ${p.street}`
      : '';

  const streetOnly = p.street || '';
  const landmarkOnly = p.name || '';
  const suburbOnly = p.suburb || p.neighbourhood || p.quarter || '';
  const districtOnly = p.district || p.city_district || '';
  const cityOnly = p.city || p.town || p.village || p.county || '';

  const name = normalizePlaceName(
    landmarkOnly ||
    houseAndStreet ||
    streetOnly ||
    suburbOnly ||
    districtOnly ||
    cityOnly ||
    'Unknown place'
  );

  /* -----------------------------------------
     Build secondary detail label
     Example:
     Quezon City • suburb • PH
     Manila • road • PH
     ----------------------------------------- */
  const admin1 = normalizePlaceName(
    p.city ||
    p.town ||
    p.village ||
    p.county ||
    p.state ||
    ''
  );

  const kind = normalizePlaceName(
    p.osm_value ||
    p.type ||
    p.osm_key ||
    ''
  );

  return {
    name,
    admin1,
    country: 'PH',
    kind,
    latitude,
    longitude
  };
}

  /**
   * =========================================================
   * LOCAL ALIAS MATCHER
   * =========================================================
   */
  function getLocalAliasMatches(keyword) {
    const cleaned = normalizePlaceName(keyword).toLowerCase();

    if (!cleaned || cleaned.length < 2) return [];

    return LOCAL_PH_ALIASES
      .filter(item =>
        item.keywords.some(key =>
          key.includes(cleaned) || cleaned.includes(key)
        ) || item.name.toLowerCase().includes(cleaned)
      )
      .map(item => ({
        name: item.name,
        admin1: item.admin1,
        country: 'PH',
        kind: item.kind,
        latitude: item.latitude,
        longitude: item.longitude
      }));
  }

  /**
   * =========================================================
   * DEDUPE RESULTS
   * =========================================================
   */
  function dedupePlaces(list) {
    const seen = new Set();

    return list.filter(item => {
      const key = `${item.name}|${item.admin1}|${item.latitude.toFixed(4)}|${item.longitude.toFixed(4)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * =========================================================
   * PLACE SUGGESTIONS FETCHER
   * Street / barangay / landmark capable, PH-focused
   * Photon is commonly used for search-as-you-type geocoding,
   * and Open-Meteo supports the hourly/current weather fields
   * used below. :contentReference[oaicite:0]{index=0}
   * =========================================================
   */
  async function fetchPlaceSuggestions(keyword) {
    const cleaned = normalizePlaceName(keyword);

    if (!cleaned || cleaned.length < 2) {
      renderSuggestions([]);
      return [];
    }

    const localMatches = getLocalAliasMatches(cleaned);

    const url =
      `https://photon.komoot.io/api/?q=${encodeURIComponent(cleaned)}` +
      `&limit=10&lat=12.8797&lon=121.7740&location_bias_scale=0.7`;

    try {
      const res = await fetch(url);
      if (!res.ok) return localMatches;

      const data = await res.json();

      const remoteMatches = (data.features || [])
        .map(normalizePhotonFeature)
        .filter(Boolean);

      return dedupePlaces([...localMatches, ...remoteMatches]).slice(0, 8);
    } catch {
      return localMatches;
    }
  }

/**
 * =========================================================
 * SUGGESTION DROPDOWN RENDERER
 * Shows clean detailed search suggestions
 * =========================================================
 */
function renderSuggestions(results = []) {
  if (!suggestionsBox) return;

  if (!results.length) {
    suggestionsBox.innerHTML = '';
    suggestionsBox.classList.add('hidden');
    return;
  }

  suggestionsBox.innerHTML = results.map((place, index) => {
    const main = escapeHtml(place.name || 'Unknown place');

    const subParts = [
      place.admin1 || '',
      place.kind || '',
      'PH'
    ].filter(Boolean);

    const sub = escapeHtml(subParts.join(' • '));

    return `
      <button type="button" class="suggestion-item" data-index="${index}">
        <span class="suggestion-main">${main}</span>
        <span class="suggestion-sub">${sub}</span>
      </button>
    `;
  }).join('');

  suggestionsBox.classList.remove('hidden');

  suggestionsBox.querySelectorAll('.suggestion-item').forEach(button => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.index);
      const chosen = results[index];

      if (!chosen) return;

      selectedSuggestion = chosen;

      if (placeInput) {
        placeInput.value = [chosen.name, chosen.admin1].filter(Boolean).join(', ');
      }

      renderSuggestions([]);
      searchWeatherFromSuggestion(chosen, '');
    });
  });
}


  /**
   * =========================================================
   * REVERSE GEOCODE NEAREST PLACE
   * Nominatim reverse can return structured address parts like
   * road, suburb, neighbourhood, city, town, village, state. :contentReference[oaicite:1]{index=1}
   * =========================================================
   */
  async function getNearestPlaceFromCoordinates(latitude, longitude) {
    const url =
      `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(latitude)}` +
      `&lon=${encodeURIComponent(longitude)}&format=jsonv2&addressdetails=1`;

    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json'
        }
      });

      if (!res.ok) {
        return {
          name: 'Current Location',
          admin1: 'PH',
          country: 'PH',
          kind: 'Current area',
          latitude,
          longitude
        };
      }

      const data = await res.json();
      const address = data.address || {};

      const name =
        normalizePlaceName(
          address.road ||
          address.pedestrian ||
          address.footway ||
          address.neighbourhood ||
          address.suburb ||
          address.quarter ||
          address.village ||
          address.town ||
          address.city_district ||
          address.city ||
          address.municipality ||
          address.county ||
          'Current Location'
        );

      const admin1 =
        normalizePlaceName(
          address.city ||
          address.municipality ||
          address.town ||
          address.county ||
          address.state ||
          'PH'
        );

      const kind =
        normalizePlaceName(
          data.type ||
          address.neighbourhood ||
          address.suburb ||
          'Current area'
        );

      return {
        name,
        admin1,
        country: 'PH',
        kind,
        latitude,
        longitude
      };
    } catch {
      return {
        name: 'Current Location',
        admin1: 'PH',
        country: 'PH',
        kind: 'Current area',
        latitude,
        longitude
      };
    }
  }

  /**
   * =========================================================
   * WEATHER REQUEST
   * Open-Meteo interpolates/serves forecast data for the given
   * coordinates, which works well as the nearest forecast point
   * behavior for landmarks and current location. :contentReference[oaicite:2]{index=2}
   * =========================================================
   */
  async function getWeather(latitude, longitude) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,rain,wind_speed_10m&hourly=temperature_2m,wind_speed_10m,precipitation,precipitation_probability,weather_code&forecast_hours=6&timezone=Asia%2FManila`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error('Hindi ko nakuha ang weather data right now.');
    }

    return res.json();
  }

  /**
   * =========================================================
   * SEARCH FROM CHOSEN SUGGESTION
   * =========================================================
   */
  async function searchWeatherFromSuggestion(placeObj, fallbackNote = '') {
    if (!placeObj || placeObj.latitude == null || placeObj.longitude == null) {
      setError('Invalid location selection.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const weather = await getWeather(placeObj.latitude, placeObj.longitude);

      latestWeatherBundle = {
        geo: placeObj,
        weather,
        fallbackNote
      };

      renderSelectedTime(-1);
    } catch (error) {
      setError(error.message || 'May error habang chine-check ang weather.');
    } finally {
      setLoading(false);
    }
  }

  /**
   * =========================================================
   * MAIN SEARCH FUNCTION
   * typed input -> suggestions -> nearest match
   * =========================================================
   */
  async function searchWeather(place) {
    const cleaned = normalizePlaceName(place);

    if (!cleaned) {
      setError('Mag-type muna ng location, gaya ng Pasig, Baguio, Cubao, o SM North.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      let chosen = selectedSuggestion;
      let fallbackNote = '';

      if (!chosen) {
        const results = await fetchPlaceSuggestions(cleaned);

        if (!results.length) {
          throw new Error('Hindi ko mahanap ang lugar na iyan. Try mo street, barangay, city, terminal, mall, o landmark sa PH.');
        }

        chosen = results[0];

        const typedLower = cleaned.toLowerCase();
        const chosenLabel = [chosen.name, chosen.admin1].filter(Boolean).join(', ').toLowerCase();
        const chosenName = (chosen.name || '').toLowerCase();

        if (!(chosenLabel.includes(typedLower) || typedLower.includes(chosenName))) {
          fallbackNote = `Walang exact match para sa "${cleaned}", kaya nearest available area ang ipinapakita.`;
        }
      }

      const weather = await getWeather(chosen.latitude, chosen.longitude);

      latestWeatherBundle = {
        geo: chosen,
        weather,
        fallbackNote
      };

      renderSelectedTime(-1);
    } catch (error) {
      setError(error.message || 'May error habang chine-check ang weather.');
    } finally {
      setLoading(false);
    }
  }

  /**
   * =========================================================
   * CURRENT LOCATION WEATHER
   * Browser geolocation generally needs user permission and a
   * secure context such as HTTPS. :contentReference[oaicite:3]{index=3}
   * =========================================================
   */
  async function searchCurrentLocationWeather() {
    if (!navigator.geolocation) {
      setError('Hindi supported ng browser mo ang current location.');
      return;
    }

    setError('');
    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;

          if (!isLikelyPhilippines(latitude, longitude)) {
            setLoading(false);
            setError('PH locations lang ang supported ng search na ito.');
            return;
          }

          const weather = await getWeather(latitude, longitude);
          const geo = await getNearestPlaceFromCoordinates(latitude, longitude);

          latestWeatherBundle = {
            geo,
            weather,
            fallbackNote: 'Pinapakita ang pinakamalapit na street, area, o city base sa current location mo.'
          };

          if (placeInput) {
            placeInput.value = [geo.name, geo.admin1].filter(Boolean).join(', ');
          }

          renderSelectedTime(-1);
        } catch (error) {
          setError(error.message || 'Hindi nakuha ang weather sa current location mo.');
        } finally {
          setLoading(false);
        }
      },
      (geoError) => {
        setLoading(false);

        if (geoError && geoError.code === 1) {
          setError('Na-block ang location permission. I-allow mo muna ang location ng browser.');
          return;
        }

        if (geoError && geoError.code === 2) {
          setError('Hindi ma-detect ang current location mo right now.');
          return;
        }

        if (geoError && geoError.code === 3) {
          setError('Nag-time out ang pagkuha ng current location. Try ulit.');
          return;
        }

        setError('Hindi ko nakuha ang current location mo.');
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 300000
      }
    );
  }

  /**
   * =========================================================
   * SEARCH BUTTON EVENT
   * =========================================================
   */
  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      renderSuggestions([]);

      if (selectedSuggestion) {
        searchWeatherFromSuggestion(selectedSuggestion, '');
        return;
      }

      searchWeather(placeInput ? placeInput.value : '');
    });
  }

  /**
   * =========================================================
   * ENTER KEY EVENT
   * =========================================================
   */
  if (placeInput) {
    placeInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        renderSuggestions([]);

        if (selectedSuggestion) {
          searchWeatherFromSuggestion(selectedSuggestion, '');
          return;
        }

        searchWeather(placeInput.value);
      }
    });
  }

  /**
   * =========================================================
   * INPUT SUGGESTIONS EVENT
   * =========================================================
   */
  if (placeInput) {
    placeInput.addEventListener('input', () => {
      selectedSuggestion = null;

      clearTimeout(suggestionDebounce);
      suggestionDebounce = setTimeout(async () => {
        const results = await fetchPlaceSuggestions(placeInput.value);
        suggestionResults = results;
        renderSuggestions(results);
      }, 250);
    });

    placeInput.addEventListener('focus', async () => {
      if (placeInput.value.trim().length >= 2) {
        const results = await fetchPlaceSuggestions(placeInput.value);
        suggestionResults = results;
        renderSuggestions(results);
      }
    });
  }

  /**
   * =========================================================
   * CLICK OUTSIDE SUGGESTIONS
   * =========================================================
   */
  document.addEventListener('click', (event) => {
    const clickedInside =
      (placeInput && placeInput.contains(event.target)) ||
      (suggestionsBox && suggestionsBox.contains(event.target));

    if (!clickedInside) {
      renderSuggestions([]);
    }
  });

  /**
   * =========================================================
   * CURRENT LOCATION BUTTON
   * =========================================================
   */
  if (currentLocationBtn) {
    currentLocationBtn.addEventListener('click', () => {
      selectedSuggestion = null;
      renderSuggestions([]);
      searchCurrentLocationWeather();
    });
  }

  /**
   * =========================================================
   * QUICK CHIP EVENTS
   * =========================================================
   */
  document.querySelectorAll('.weather-chip').forEach(button => {
    button.addEventListener('click', () => {
      const place = button.dataset.place || '';
      selectedSuggestion = null;

      if (placeInput) placeInput.value = place;
      renderSuggestions([]);
      searchWeather(place);
    });
  });

  /**
   * =========================================================
   * DEFAULT INITIAL LOAD
   * =========================================================
   */
  searchWeatherFromSuggestion(
    {
      name: 'Pasig',
      admin1: 'NCR',
      country: 'PH',
      kind: 'City',
      latitude: 14.5764,
      longitude: 121.0851
    },
    ''
  );

  /**
   * =========================================================
   * AUTO REFRESH EVERY 5 MINUTES
   * =========================================================
   */
  setInterval(() => {
    if (!latestWeatherBundle?.geo) return;

    const { geo, fallbackNote } = latestWeatherBundle;

    if (geo.latitude != null && geo.longitude != null) {
      searchWeatherFromSuggestion(geo, fallbackNote || '');
    }
  }, 300000);
});

/**
 * =========================================================
 * LIVE CLOCK UPDATE
 * Updates "Now • HH:MM" every minute without API calls
 * =========================================================
 */
setInterval(() => {

  const label = document.querySelector('.now-label');
  if (!label) return;

  label.textContent = formatNowLabel();

}, 60000);
