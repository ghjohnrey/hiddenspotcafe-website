document.addEventListener("DOMContentLoaded", () => {

  /**
  =========================================================
  DOM REFERENCES
  =========================================================
  */

  const placeInput = document.getElementById("placeInput");
  const searchBtn = document.getElementById("searchBtn");
  const currentLocationBtn = document.getElementById("currentLocationBtn");
  const suggestionsBox = document.getElementById("suggestionsBox");

  const summaryPill = document.getElementById("summaryPill");
  const locationTitle = document.getElementById("locationTitle");
  const bigAnswer = document.getElementById("bigAnswer");
  const mainExplanation = document.getElementById("mainExplanation");

  const tempValue = document.getElementById("tempValue");
  const rainValue = document.getElementById("rainValue");
  const windValue = document.getElementById("windValue");

  const goOutImage = document.getElementById("goOutImage");
  const laundryImage = document.getElementById("laundryImage");

  const goOutTitle = document.getElementById("goOutTitle");
  const goOutText = document.getElementById("goOutText");

  const laundryTitle = document.getElementById("laundryTitle");
  const laundryText = document.getElementById("laundryText");

  const bringList = document.getElementById("bringList");
  const laundryList = document.getElementById("laundryList");

  const smartGoOut = document.getElementById("smartGoOut");
  const smartUmbrella = document.getElementById("smartUmbrella");
  const smartDrying = document.getElementById("smartDrying");
  const smartLaundry = document.getElementById("smartLaundry");

  const hourlyList = document.getElementById("hourlyList");

  /**
  =========================================================
  STATE
  =========================================================
  */

  let latestWeatherBundle = null;
  let selectedSuggestion = null;
  let debounceTimer = null;

  /**
  =========================================================
  WEATHER IMAGES
  =========================================================
  */

  const WEATHER_IMAGES = {

    clear: {
      goOut: "/rain-check/weather-images/clear-go-out.webp",
      laundry: "/rain-check/weather-images/clear-laundry.webp"
    },

    cloudy: {
      goOut: "/rain-check/weather-images/partly-cloudy-go-out.webp",
      laundry: "/rain-check/weather-images/partly-cloudy-laundry.webp"
    },

    rain: {
      goOut: "/rain-check/weather-images/moderate-rain-go-out.webp",
      laundry: "/rain-check/weather-images/moderate-rain-laundry.webp"
    },

    storm: {
      goOut: "/rain-check/weather-images/thunderstorm-go-out.webp",
      laundry: "/rain-check/weather-images/thunderstorm-laundry.webp"
    }

  };

  /**
  =========================================================
  NORMALIZE TEXT
  =========================================================
  */

  function clean(text) {
    return (text || "").trim().replace(/\s+/g," ");
  }

  /**
  =========================================================
  WEATHER GROUP
  =========================================================
  */

  function weatherGroup(code, rain) {

    if ([95,96,99].includes(code)) return "storm";
    if (rain > 0) return "rain";
    if ([1,2,3,45,48].includes(code)) return "cloudy";
    return "clear";

  }

  /**
  =========================================================
  IMAGE SWITCH
  =========================================================
  */

  function updateImages(group){

    const set = WEATHER_IMAGES[group] || WEATHER_IMAGES.clear;

    if(goOutImage) goOutImage.src = set.goOut;
    if(laundryImage) laundryImage.src = set.laundry;

  }

  /**
  =========================================================
  WEATHER API
  =========================================================
  */

  async function getWeather(lat,lon){

    const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`+
    `&current=temperature_2m,weather_code,rain,wind_speed_10m`+
    `&hourly=temperature_2m,precipitation,precipitation_probability,weather_code`+
    `&forecast_hours=6&timezone=Asia%2FManila`;

    const r = await fetch(url);

    if(!r.ok) throw new Error("Weather unavailable");

    return r.json();

  }

  /**
  =========================================================
  SUMMARY
  =========================================================
  */

  function summarize(place, group){

    if(group==="storm"){

      return{
        answer:"Thunderstorm conditions.",
        explanation:`May thunderstorm activity malapit sa ${place}.`
      }

    }

    if(group==="rain"){

      return{
        answer:"Umuulan ngayon.",
        explanation:`May ulan sa ${place} base sa latest weather data.`
      }

    }

    if(group==="cloudy"){

      return{
        answer:"Walang ulan ngayon.",
        explanation:`Makulimlim ang weather sa ${place}.`
      }

    }

    return{
      answer:"Clear weather ngayon.",
      explanation:`Mukhang okay ang panahon sa ${place}.`
    }

  }

  /**
  =========================================================
  GO OUT ADVICE
  =========================================================
  */

  function goOutAdvice(group){

    if(group==="storm"){

      return{
        title:"Better stay indoors",
        text:"Thunderstorm conditions ngayon.",
        items:[
          "Iwasan ang outdoor travel.",
          "Mag-ingat sa kidlat.",
          "Secure gadgets sa ulan."
        ]
      }

    }

    if(group==="rain"){

      return{
        title:"Pwede lumabas pero rain ready",
        text:"May ulan sa area.",
        items:[
          "Magdala ng payong.",
          "Iwas sa baha.",
          "Waterproof shoes recommended."
        ]
      }

    }

    return{
      title:"Good time lumabas",
      text:"Okay ang weather ngayon.",
      items:[
        "Normal outfit is fine.",
        "Optional ang umbrella."
      ]
    }

  }

  /**
  =========================================================
  LAUNDRY ADVICE
  =========================================================
  */

  function laundryAdvice(group){

    if(group==="storm"){

      return{
        title:"Do not dry clothes outside",
        text:"Storm conditions.",
        items:["Indoor drying only."]
      }

    }

    if(group==="rain"){

      return{
        title:"Not ideal magsampay",
        text:"May ulan sa area.",
        items:["Indoor sampayan recommended."]
      }

    }

    return{
      title:"Good day para maglaba",
      text:"Dry weather conditions.",
      items:["Pwede magsampay sa labas."]
    }

  }

  /**
  =========================================================
  SMART ENGINE
  =========================================================
  */

  function smartEngine(group){

    if(group==="storm"){
      return{
        goOut:"NO",
        umbrella:"YES",
        drying:"NO",
        laundry:"INDOOR ONLY"
      }
    }

    if(group==="rain"){
      return{
        goOut:"LIMITED",
        umbrella:"YES",
        drying:"NO",
        laundry:"INDOOR"
      }
    }

    return{
      goOut:"YES",
      umbrella:"OPTIONAL",
      drying:"YES",
      laundry:"YES"
    }

  }

  /**
  =========================================================
  RENDER WEATHER
  =========================================================
  */

  function renderWeather(place,weather){

    const rain = weather.current.rain || 0;
    const code = weather.current.weather_code;

    const group = weatherGroup(code,rain);

    const summary = summarize(place,group);
    const go = goOutAdvice(group);
    const wash = laundryAdvice(group);
    const smart = smartEngine(group);

    updateImages(group);

    locationTitle.textContent = place;
    bigAnswer.textContent = summary.answer;
    mainExplanation.textContent = summary.explanation;

    tempValue.textContent = Math.round(weather.current.temperature_2m)+"°C";
    rainValue.textContent = rain+" mm";
    windValue.textContent = Math.round(weather.current.wind_speed_10m)+" km/h";

    goOutTitle.textContent = go.title;
    goOutText.textContent = go.text;

    laundryTitle.textContent = wash.title;
    laundryText.textContent = wash.text;

    bringList.innerHTML = go.items.map(x=>`<li>${x}</li>`).join("");
    laundryList.innerHTML = wash.items.map(x=>`<li>${x}</li>`).join("");

    smartGoOut.textContent = smart.goOut;
    smartUmbrella.textContent = smart.umbrella;
    smartDrying.textContent = smart.drying;
    smartLaundry.textContent = smart.laundry;

  }

  /**
  =========================================================
  PHOTON SEARCH (LANDMARK / STREET / BRGY)
  =========================================================
  */

  async function fetchSuggestions(query){

    if(query.length<2){
      suggestionsBox.innerHTML="";
      suggestionsBox.classList.add("hidden");
      return;
    }

    const url=`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=8`;

    const r = await fetch(url);

    const data = await r.json();

    const results = data.features || [];

    suggestionsBox.innerHTML="";

    results.forEach((f,i)=>{

      const p=f.properties;
      const coords=f.geometry.coordinates;

      const name = p.name || p.street || p.suburb || p.city || "Unknown";

      const label = `${name} ${p.city||""} PH`;

      const btn=document.createElement("button");
      btn.className="suggestion-item";
      btn.textContent=label;

      btn.onclick=()=>{

        suggestionsBox.classList.add("hidden");

        selectedSuggestion={
          name:label,
          lat:coords[1],
          lon:coords[0]
        };

        placeInput.value=label;

        fetchWeather(label,coords[1],coords[0]);

      };

      suggestionsBox.appendChild(btn);

    });

    suggestionsBox.classList.remove("hidden");

  }

  /**
  =========================================================
  CURRENT LOCATION
  =========================================================
  */

  async function currentLocationWeather(){

    navigator.geolocation.getCurrentPosition(async pos=>{

      const lat=pos.coords.latitude;
      const lon=pos.coords.longitude;

      const weather=await getWeather(lat,lon);

      renderWeather("Current Location PH",weather);

    });

  }

  /**
  =========================================================
  FETCH WEATHER
  =========================================================
  */

  async function fetchWeather(label,lat,lon){

    const weather = await getWeather(lat,lon);

    renderWeather(label,weather);

  }

  /**
  =========================================================
  INPUT SEARCH
  =========================================================
  */

  placeInput.addEventListener("input",()=>{

    clearTimeout(debounceTimer);

    debounceTimer=setTimeout(()=>{

      fetchSuggestions(placeInput.value);

    },250);

  });

  /**
  =========================================================
  SEARCH BUTTON
  =========================================================
  */

  searchBtn.onclick=()=>{

    if(selectedSuggestion){

      fetchWeather(
        selectedSuggestion.name,
        selectedSuggestion.lat,
        selectedSuggestion.lon
      );

    }

  };

  /**
  =========================================================
  CURRENT LOCATION BUTTON
  =========================================================
  */

  if(currentLocationBtn){

    currentLocationBtn.onclick=currentLocationWeather;

  }

  /**
  =========================================================
  DEFAULT LOAD
  =========================================================
  */

  fetchWeather("Pasig PH",14.5764,121.0851);

});
