document.addEventListener("DOMContentLoaded", () => {

  /* ===============================
     MENU PAGE: DRINK TOGGLE CARDS
     Only run if #productContainer exists
  =============================== */

  const container = document.getElementById("productContainer");

  if (container) {
    /* DRINK DESCRIPTIONS */
    const descriptions = {
      love: "Sweet strawberry soda with real fruit bits. Bright and refreshing.",
      sun: "Tropical mango blend with a smooth, sunny finish.",
      emerald: "Crisp green apple with a clean sparkling bite.",
      night: "Deep blueberry fizz with a cool fruity twist.",
      moon: "Light lychee sparkle with a smooth floral touch."
    };

    const potionExtra = " Transformed into potion. Infused with magical dust.";

    const glowColors = {
      love: "#ff4d6d",
      sun: "#ffb703",
      emerald: "#2ecc71",
      night: "#4361ee",
      moon: "#c77dff"
    };

    const products = ["love", "sun", "emerald", "night", "moon"];
    const prices = { elixir: 39, potion: 49 };
    const state = {};

    products.forEach(id => {
      state[id] = "elixir";

      const card = document.createElement("div");
      card.className = "card";
      card.onclick = () => togglePotion(card, id);

      card.innerHTML = `
        ${id === "love" ? '<div class="badge">Best Seller</div>' : ''}
        <img src="/assets/images/drinks/${id}.png" class="drink-img">
        <h3>${capitalize(id)} Elixir</h3>
        <p class="desc">${descriptions[id]}</p>
        <p class="price">₱${prices.elixir}</p>
      `;

      container.appendChild(card);
    });

    function capitalize(str) {
      return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function togglePotion(card, id) {
      const img = card.querySelector("img");
      const title = card.querySelector("h3");
      const price = card.querySelector(".price");
      const desc = card.querySelector(".desc");

      if (state[id] === "elixir") {
        state[id] = "potion";
        img.src = `/assets/images/drinks/${id}-potion.png`;
        title.innerText = capitalize(id) + " Potion";
        price.innerText = "₱" + prices.potion;
        desc.innerText = descriptions[id] + potionExtra;
        img.style.boxShadow = "0 0 35px " + glowColors[id];
        startGlitter(card);
      } else {
        state[id] = "elixir";
        img.src = `/assets/images/drinks/${id}.png`;
        title.innerText = capitalize(id) + " Elixir";
        price.innerText = "₱" + prices.elixir;
        desc.innerText = descriptions[id];
        img.style.boxShadow = "none";
      }
    }

    function startGlitter(card) {
      for (let i = 0; i < 20; i++) {
        const g = document.createElement("div");
        g.className = "glitter";
        g.style.left = Math.random() * 300 + "px";
        g.style.bottom = "50px";
        card.appendChild(g);
        setTimeout(() => g.remove(), 2000);
      }
    }
  }


  /* ===============================
     HEADER SPARKLES
     Only run if a <header> exists
  =============================== */

  function createSparkles() {
    const header = document.querySelector("header");
    if (!header) return;

    for (let i = 0; i < 25; i++) {
      const s = document.createElement("div");
      s.className = "sparkle";

      s.style.top = Math.random() * 100 + "%";
      s.style.left = Math.random() * 100 + "%";
      s.style.animationDelay = Math.random() * 4 + "s";
      s.style.opacity = Math.random() * 0.4;

      header.appendChild(s);
    }
  }
  createSparkles();


  /* ===============================
     NAVBAR PREMIUM INTERACTIONS
     Safe on every page
  =============================== */

  // Scroll shadow
  const navbar = document.querySelector(".navbar");
  if (navbar) {
    window.addEventListener("scroll", () => {
      if (window.scrollY > 30) navbar.classList.add("scrolled");
      else navbar.classList.remove("scrolled");
    });
  }

  // Mobile toggle
  const hamburger = document.getElementById("hamburger");
  const navLinks = document.getElementById("navLinks");

  if (hamburger && navLinks) {
    hamburger.addEventListener("click", () => {
      navLinks.classList.toggle("active");
      hamburger.classList.toggle("open"); // X animation
    });
  }

  // Auto highlight active link (works even if /stories/ has trailing slash)
  const currentPath = window.location.pathname.replace(/\/$/, "");
  const links = document.querySelectorAll(".nav-link");

  links.forEach(link => {
    const href = (link.getAttribute("href") || "").replace(/\/$/, "");
    if (href === currentPath) link.classList.add("active");
  });

});