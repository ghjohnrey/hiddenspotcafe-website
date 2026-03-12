document.addEventListener('DOMContentLoaded', () => {
  /**
   * =========================================================
   * DOM REFERENCES
   * Lahat ng UI elements na ina-update ng weather page
   * =========================================================
   */
  const placeInput = document.getElementById('placeInput');
  const searchBtn = document.getElementById('searchBtn');
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

  // Timeline meta UI sa hourly card
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

  /**
   * =========================================================
   * INTERNAL STATE
   * Dito tinatago ang latest fetched weather para magamit ulit
   * kapag pumipili ang user ng oras sa hourly card.
   * =========================================================
   */
  let latestWeatherBundle = null;
  let activeTimeIndex = -1; // -1 = current weather, 0..5 = hourly row index

  /**
   * =========================================================
   * WEATHER LABELS
   * Human-readable labels ng weather codes
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
   * Image pair per weather category
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
   * UI HELPERS
   * Loading and error state controls
   * =========================================================
   */
  function setLoading(isLoading) {
    loadingState.classList.toggle('hidden', !isLoading);
    searchBtn.disabled = isLoading;
  }

  function setError(message = '') {
    errorState.textContent = message;
    errorState.classList.toggle('hidden', !message);
  }

  /**
   * =========================================================
   * INPUT NORMALIZER
   * Nililinis ang location input
   * =========================================================
   */
  function normalizePlaceName(value) {
    return `${value || ''}`.replace(/\s+/g, ' ').trim();
  }

  /**
   * =========================================================
   * SHORT REGION LABEL
   * Ginagawang mas maiksi ang region/admin label para sa UI
   * Example:
   * National Capital Region -> NCR
   * =========================================================
   */
  function shortRegionLabel(admin1 = '') {
    const value = `${admin1}`.trim();

    if (value === 'National Capital Region') return 'NCR';
    if (value === 'Cordillera Administrative Region') return 'CAR';
    if (value === 'Bangsamoro Autonomous Region in Muslim Mindanao') return 'BARMM';

    return value;
  }

  /**
   * =========================================================
   * BASIC PAGE MOOD
   * Broad mood lang para sa page atmosphere
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
   * Ito ang ginagamit para sa advice at image switching
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
   * WEATHER ICON
   * Quick visual emoji sa summary card
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
   * Para readable ang oras at last updated text
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
   * WEATHER LABEL RESOLVER
   * Code -> readable label
   * =========================================================
   */
  function weatherText(code) {
    return WEATHER_LABELS[code] || 'Weather update';
  }

  /**
   * =========================================================
   * PAGE MOOD APPLIER
   * Nagpapalit ng body class ayon sa broad weather mood
   * =========================================================
   */
  function applyPageMood(group) {
    document.body.classList.remove('weather-clear', 'weather-cloudy', 'weather-rain', 'weather-storm');
    document.body.classList.add(`weather-${group}`);

    goOutArt.classList.remove('art-clear', 'art-cloudy', 'art-rain', 'art-storm');
    laundryArt.classList.remove('art-clear', 'art-cloudy', 'art-rain', 'art-storm');

    goOutArt.classList.add(`art-${group}`);
    laundryArt.classList.add(`art-${group}`);
  }

  /**
   * =========================================================
   * IMAGE SWITCHER
   * Nagpapalit ng image depende sa detailed category
   * =========================================================
   */
  function updateAdviceImages(category) {
    const selected = WEATHER_IMAGES[category] || WEATHER_IMAGES.partlyCloudy;

    goOutImage.src = selected.goOut;
    laundryImage.src = selected.laundry;
  }

  /**
   * =========================================================
   * SUMMARY TEXT
   * Top answer kung umuulan ba at anong ibig sabihin nun
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
   * Advice para sa paglabas batay sa selected time snapshot
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
          temp >= 31 ? 'Mainit pa rin kahit maulan, so breathable clothes pa rin ang best.' : 'Mas okay ang extra layer or pamalit kung mababasa ka.',
          wind >= 20 ? 'May hangin din, so secure your bag at iwas sa sobrang gaan na payong.' : 'Lagyan ng protection ang gadgets at important papers.'
        ]
      };
    }

    if (category === 'lightRain') {
      return {
        title: 'Pwede lumabas, pero rain-ready ka dapat',
        text: 'May ambon o mataas ang chance ng ulan sa next hours, kaya mas okay kung prepared ka bago umalis.',
        items: [
          'Magdala ng compact umbrella o light rain jacket.',
          temp >= 31 ? 'Piliin ang preskong suot kahit may chance ng ulan.' : 'Okay ang regular outfit, pero better kung mabilis matuyo ang tela.',
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
        nextThreeProb >= 40 ? 'May konting chance ng ulan later, so check ulit bago umalis nang matagal.' : 'Mas convenient ito for errands, short trips, or quick cafe runs.'
      ]
    };
  }

  /**
   * =========================================================
   * LAUNDRY ADVICE
   * Advice para sa paglalaba batay sa selected time snapshot
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
          temp >= 31 && wind >= 10 ? 'May konting drying help from init at hangin, pero ulan pa rin ang deciding factor.' : 'Expect na mabagal ang pagpapatuyo ng damit.'
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
        wind >= 10 ? 'May enough hangin para makatulong sa pagpapatuyo.' : 'Hindi sobrang mahangin, pero okay pa rin kung maaraw at hindi maulan.',
        temp >= 31 ? 'Samantalahin ang init dahil mas mabilis matuyo ang damit.' : 'Bantayan pa rin ang next update kahit maganda ang forecast ngayon.'
      ]
    };
  }

  /**
   * =========================================================
   * LIST RENDERER
   * Array -> <li> list
   * =========================================================
   */
  function renderList(target, items) {
    target.innerHTML = items.map(item => `<li>${item}</li>`).join('');
  }

  /**
   * =========================================================
   * UPCOMING PROBABILITIES HELPER
   * Kumukuha ng next N probabilities mula sa selected index
   * =========================================================
   */
  function getUpcomingProbabilities(hourly, startIndex, count = 3) {
    return hourly.precipitation_probability
      .slice(startIndex, startIndex + count)
      .map(n => Number(n || 0));
  }

  /**
   * =========================================================
   * SNAPSHOT BUILDER
   * Gumagawa ng single selected-time snapshot.
   * - index = -1 => current weather
   * - index >= 0 => hourly weather row
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
        currentProbability: Math.round(hourly.precipitation_probability[0] || 0),
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
      currentProbability: Math.round(hourly.precipitation_probability[index] || 0),
      nextThreeProbabilities: getUpcomingProbabilities(hourly, index, 3)
    };
  }

  /**
   * =========================================================
   * MAIN UI RENDERER FOR SELECTED TIME
   * Lahat ng summary, advice, image, at mood dito ina-update
   * base sa active selected time row.
   * =========================================================
   */
  function renderSelectedTime(index) {
    if (!latestWeatherBundle) return;

    activeTimeIndex = index;

    const { geo, weather } = latestWeatherBundle;
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

    summaryPill.textContent = index === -1
      ? `📍 ${placeName}`
      : `📍 ${placeName} • ${snapshot.label}`;

    // Timeline meta update
    if (timelineTime && timelinePlace) {
      timelineTime.textContent = snapshot.label;
      timelinePlace.textContent = shortPlaceName;
    } else if (timelineMeta) {
      timelineMeta.textContent = `${snapshot.label} • ${shortPlaceName}`;
    }

    locationTitle.textContent = placeName;
    bigAnswer.textContent = summary.answer;
    mainExplanation.textContent = `${summary.explanation} Selected time: ${snapshot.label}. Condition: ${weatherText(snapshot.weather_code)}.`;

    tempValue.textContent = `${Math.round(temp)}°C`;
    rainValue.textContent = `${rainNow.toFixed(1)} mm`;
    windValue.textContent = `${Math.round(wind)} km/h`;
    updatedValue.textContent = formatUpdated(snapshot.time, weather.timezone);
    summaryEmoji.textContent = weatherEmojiFor(group, snapshot.weather_code);

    readingGuide.textContent = index === -1
      ? 'Ang current view ay base sa latest current weather plus short forecast. Maaari mong i-click ang ibang oras sa “Weather timeline” para makita ang projected advice at status sa oras na iyon.'
      : `Ang current view ay naka-base sa selected time na ${snapshot.label}. Kaya ang advice, images, at status ay naka-sync sa oras na pinili mo.`;

    goOutTitle.textContent = goOut.title;
    goOutText.textContent = goOut.text;
    laundryTitle.textContent = laundry.title;
    laundryText.textContent = laundry.text;

    renderList(bringList, goOut.items);
    renderList(laundryList, laundry.items);

    applyPageMood(group);
    updateAdviceImages(category);
    renderHourly(weather.hourly, weather.timezone, index);
  }

  /**
   * =========================================================
   * HOURLY FORECAST RENDERER
   * Nagre-render ng clickable time rows.
   * May extra row sa unahan para sa Current time.
   * =========================================================
   */
  function renderHourly(hourly, timezone, selectedIndex = -1) {
    const currentRow = `
      <button class="hour-row current-row ${selectedIndex === -1 ? 'active' : ''}" type="button" data-time-index="-1">
        <div class="hour-time-label">Current time</div>
        <div class="hour-bar"><span style="width:${Math.max(0, Math.min(100, Math.round(hourly.precipitation_probability[0] || 0)))}%"></span></div>
        <div>${Number(hourly.precipitation[0] || 0).toFixed(1)} mm</div>
      </button>
    `;

    const rows = hourly.time.slice(0, 6).map((time, index) => {
      const probability = Math.max(0, Math.min(100, Math.round(hourly.precipitation_probability[index] || 0)));
      const amount = Number(hourly.precipitation[index] || 0);

      return `
        <button class="hour-row ${selectedIndex === index ? 'active' : ''}" type="button" data-time-index="${index}">
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
   * GEOCODING REQUEST
   * Place name -> lat/lon
   * =========================================================
   */
  async function geocodePlace(place) {
    const query = encodeURIComponent(place);
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=10&language=en&format=json&countryCode=PH`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error('Hindi ko nakuha ang location data right now.');
    }

    const data = await res.json();

    if (!data.results || !data.results.length) {
      throw new Error('Hindi ko mahanap ang lugar na iyan. Try mo city or municipality name sa Pilipinas.');
    }

    return data.results[0];
  }

  /**
   * =========================================================
   * WEATHER REQUEST
   * Kumuha ng current + hourly weather data
   * Note:
   * Dinagdagan natin ng hourly temperature at wind para
   * mas meaningful ang advice kapag hourly row ang selected.
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
   * MAIN SEARCH FUNCTION
   * Fetches location + weather, saves latest bundle,
   * then defaults to Current time selected view.
   * =========================================================
   */
  async function searchWeather(place) {
    const cleaned = normalizePlaceName(place);

    if (!cleaned) {
      setError('Mag-type muna ng location, gaya ng Pasig, Baguio, or Cebu City.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const geo = await geocodePlace(cleaned);
      const weather = await getWeather(geo.latitude, geo.longitude);

      latestWeatherBundle = { geo, weather };
      renderSelectedTime(-1);
    } catch (error) {
      setError(error.message || 'May error habang chine-check ang weather.');
    } finally {
      setLoading(false);
    }
  }

  /**
   * =========================================================
   * SEARCH BUTTON EVENT
   * =========================================================
   */
  searchBtn?.addEventListener('click', () => searchWeather(placeInput.value));

  /**
   * =========================================================
   * ENTER KEY SEARCH
   * =========================================================
   */
  placeInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      searchWeather(placeInput.value);
    }
  });

  /**
   * =========================================================
   * QUICK CHIP EVENTS
   * =========================================================
   */
  document.querySelectorAll('.weather-chip').forEach(button => {
    button.addEventListener('click', () => {
      const place = button.dataset.place;
      placeInput.value = place;
      searchWeather(place);
    });
  });

  /**
   * =========================================================
   * DEFAULT INITIAL LOAD
   * =========================================================
   */
  searchWeather('Pasig');

  /**
   * =========================================================
   * AUTO REFRESH EVERY 5 MINUTES
   * Kapag current place ang page, nire-refresh ang data
   * pero ibinabalik sa current time selected view.
   * =========================================================
   */
  setInterval(() => {
    const currentPlace = normalizePlaceName(locationTitle.textContent.split(',')[0]);

    if (currentPlace && currentPlace !== 'Pick a place in the Philippines') {
      searchWeather(currentPlace);
    }
  }, 300000);
});
