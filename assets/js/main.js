/* THEME 10 — "Ironside" front-end behaviours. Sections are inlined at
   generation time, so there is no client-side component loading.

   Lead capture on static city/state exports is NOT handled here: forms carry
   `data-rl-lead` and the shared central injector adds the config, capture JS,
   honeypot and Turnstile at export time. This file powers the presentational
   behaviours plus the nationwide/subdomain self-contained lead handler
   (`data-t8-form`), which the dynamic renderer needs because the export-time
   injector does not run there. */

function initNavigation() {
  const toggle = document.querySelector(".nav-toggle");
  const menu = document.querySelector(".nav-links");
  if (!toggle || !menu) return;
  const setOpen = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    menu.classList.toggle("open", open);
    document.body.classList.toggle("menu-open", open);
  };
  toggle.addEventListener("click", () => {
    setOpen(toggle.getAttribute("aria-expanded") !== "true");
  });
  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setOpen(false));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });
}

/* Copy a service-offer code to the clipboard (concept "Copy offer" buttons). */
function initOfferCodes() {
  document.querySelectorAll("[data-copy-code]").forEach((button) => {
    const original = button.innerHTML;
    button.addEventListener("click", async () => {
      const code = button.dataset.copyCode || "";
      try {
        await navigator.clipboard.writeText(code);
        button.textContent = "Copied " + code + " ✓";
      } catch (_e) {
        button.textContent = "Code: " + code;
      }
      setTimeout(() => {
        button.innerHTML = original;
      }, 2600);
    });
  });
}

/* Newsletter is a presentational-only sign-up (not a lead form). */
function initNewsletter() {
  const form = document.getElementById("newsletter-form");
  if (!form) return;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const button = form.querySelector("button");
    if (button) {
      button.textContent = "You're on the list ✓";
      button.disabled = true;
    }
  });
}

/* Scroll-reveal without any external library (replaces the concept's sal.js).
   Adds `.sal-animate` as each [data-sal] element scrolls into view; honours
   data-sal-delay and prefers-reduced-motion, and degrades to "show all" when
   IntersectionObserver is unavailable. */
function initReveal() {
  var els = document.querySelectorAll("[data-sal]");
  if (!els.length) return;
  var reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !("IntersectionObserver" in window)) {
    els.forEach(function (el) {
      el.classList.add("sal-animate");
    });
    return;
  }
  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var delay = parseInt(el.getAttribute("data-sal-delay") || "0", 10);
        if (delay) el.style.transitionDelay = delay + "ms";
        el.classList.add("sal-animate");
        io.unobserve(el);
      });
    },
    { threshold: 0.08, rootMargin: "0px 0px -40px 0px" },
  );
  els.forEach(function (el) {
    io.observe(el);
  });
}

/* Lead capture for NATIONWIDE / SUBDOMAIN pages (data-t8-form). Static
   city/state exports carry `data-rl-lead` and are wired by the shared
   export-time injector — that injector does NOT run for the dynamic nationwide
   renderer, so those pages ship this self-contained handler instead. Config,
   when present, arrives via `window.__RL_LEADS`; without it the form still
   shows the success state. */
function leadsConfig() {
  var c = window.__RL_LEADS || {};
  var base = String(c.apiBase || "");
  var siteId = String(c.siteId || "");
  if (!/^https?:\/\//.test(base)) return null;
  if (!siteId || siteId.indexOf("{{") !== -1) return null;
  var key = String(c.turnstileSiteKey || "");
  if (!key || key.indexOf("{{") !== -1) key = "";
  return {
    apiBase: base.replace(/\/+$/, ""),
    siteId: siteId,
    turnstileSiteKey: key,
  };
}

var _tsState = { loading: false, loaded: false, queue: [] };
function loadTurnstile(cb) {
  if (_tsState.loaded && window.turnstile) return cb();
  _tsState.queue.push(cb);
  if (_tsState.loading) return;
  _tsState.loading = true;
  window.__rlTurnstileReady = function () {
    _tsState.loaded = true;
    _tsState.queue.forEach(function (f) {
      f();
    });
    _tsState.queue = [];
  };
  var s = document.createElement("script");
  s.src =
    "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=__rlTurnstileReady&render=explicit";
  s.async = true;
  s.defer = true;
  document.head.appendChild(s);
}
function mountTurnstile(form, siteKey) {
  if (!siteKey || form.__rlTs) return;
  form.__rlTs = true;
  var box = document.createElement("div");
  box.className = "rl-turnstile";
  var submit = form.querySelector('button[type="submit"]');
  if (submit && submit.parentNode) submit.parentNode.insertBefore(box, submit);
  else form.appendChild(box);
  loadTurnstile(function () {
    if (window.turnstile) window.turnstile.render(box, { sitekey: siteKey });
  });
}
function initLeadForms() {
  var cfg = leadsConfig();
  document.querySelectorAll("form[data-t8-form]").forEach((form) => {
    if (cfg && cfg.turnstileSiteKey) {
      form.addEventListener(
        "focusin",
        function () {
          mountTurnstile(form, cfg.turnstileSiteKey);
        },
        { once: true },
      );
    }
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const submit = form.querySelector('button[type="submit"]');
      const hp = form.querySelector('[name="_hp"]');
      const isBot = hp && hp.value;
      if (cfg && !isBot) {
        const data = {};
        new FormData(form).forEach((value, key) => {
          if (key === "_hp") return;
          data[key] = typeof value === "string" ? value : String(value);
        });
        data.pageUrl = window.location.href;
        const tokenInput = form.querySelector('[name="cf-turnstile-response"]');
        if (tokenInput && tokenInput.value) data.turnstileToken = tokenInput.value;
        try {
          fetch(cfg.apiBase + "/api/leads/" + encodeURIComponent(cfg.siteId), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
            keepalive: true,
          }).catch(() => {});
        } catch (_e) {
          /* ignore — still show success below */
        }
      }
      form.querySelector(".form-success")?.classList.add("visible");
      if (submit) {
        submit.disabled = true;
        submit.innerHTML = "Request received ✓";
      }
    });
  });
}

/* Interactive click-to-expand neighborhoods, search filter, and chip action */
function initLandmarkNeighborhoods() {
  const cards = document.querySelectorAll(".gmap-landmark-card");
  if (!cards.length) return;

  // 1. Accordion Drawer toggle
  cards.forEach((card) => {
    const toggleBtn = card.querySelector(".gmap-hoods-toggle");
    const collapsePanel = card.querySelector(".gmap-hoods-collapse");
    if (!toggleBtn || !collapsePanel) return;

    const toggle = (forceState) => {
      const isOpen = toggleBtn.getAttribute("aria-expanded") === "true";
      const nextState = typeof forceState === "boolean" ? forceState : !isOpen;
      toggleBtn.setAttribute("aria-expanded", String(nextState));
      collapsePanel.classList.toggle("is-open", nextState);
    };

    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggle();
    });

    // Clicking anywhere on card outside direct actions
    card.addEventListener("click", (e) => {
      if (e.target.closest("a") || e.target.closest("button") || e.target.closest(".gmap-hood-chip")) return;
      toggle();
    });

    // 2. Chip click action -> direct call to dispatch
    const chips = card.querySelectorAll(".gmap-hood-chip");
    chips.forEach((chip) => {
      chip.addEventListener("click", (e) => {
        e.stopPropagation();
        window.location.href = "tel:9411234567";
      });
    });
  });

  // 3. Live Search & Filter Bar
  const searchInput = document.getElementById("gmap-landmark-search");
  const clearBtn = document.getElementById("gmap-search-clear");
  const countTag = document.getElementById("gmap-search-count");

  if (searchInput) {
    const totalCount = cards.length;

    const filterCards = (query) => {
      const q = (query || "").toLowerCase().trim();
      let matchCount = 0;

      cards.forEach((card) => {
        const textContent = (card.textContent || "").toLowerCase();
        const keywords = (card.getAttribute("data-keywords") || "").toLowerCase();
        const isMatch = !q || textContent.includes(q) || keywords.includes(q);

        card.style.display = isMatch ? "flex" : "none";

        if (isMatch) {
          matchCount++;
          // If user searched a specific term, auto-expand matching drawers
          if (q.length >= 2) {
            const collapsePanel = card.querySelector(".gmap-hoods-collapse");
            const toggleBtn = card.querySelector(".gmap-hoods-toggle");
            if (collapsePanel && toggleBtn) {
              collapsePanel.classList.add("is-open");
              toggleBtn.setAttribute("aria-expanded", "true");
            }
          }
        }
      });

      if (clearBtn) {
        clearBtn.hidden = !q;
      }

      if (countTag) {
        if (!q) {
          countTag.textContent = "Showing all " + totalCount + " service hubs";
        } else if (matchCount === 0) {
          countTag.textContent = "0 matches for \"" + query + "\" — Call 941-123-4567 for any Sarasota ZIP";
        } else {
          countTag.textContent = "Found " + matchCount + " matching location" + (matchCount > 1 ? "s" : "");
        }
      }
    };

    searchInput.addEventListener("input", (e) => {
      filterCards(e.target.value);
    });

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        searchInput.value = "";
        filterCards("");
        searchInput.focus();
        cards.forEach((card) => {
          const collapsePanel = card.querySelector(".gmap-hoods-collapse");
          const toggleBtn = card.querySelector(".gmap-hoods-toggle");
          if (collapsePanel && toggleBtn) {
            collapsePanel.classList.remove("is-open");
            toggleBtn.setAttribute("aria-expanded", "false");
          }
        });
      });
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initOfferCodes();
  initNewsletter();
  initLeadForms();
  initReveal();
  initLandmarkNeighborhoods();
});

