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

/* Interactive click-to-expand neighborhoods, search filter, and ZIP checker */
function initLandmarkNeighborhoods() {
  const cards = document.querySelectorAll(".gmap-landmark-card");
  if (!cards.length) return;

  const toggleAllBtn = document.getElementById("gmap-toggle-view-all");
  const searchInput = document.getElementById("gmap-landmark-search");
  const clearBtn = document.getElementById("gmap-search-clear");
  const countTag = document.getElementById("gmap-search-count");
  const zipPills = document.querySelectorAll(".zip-pill");
  const zipResult = document.getElementById("zip-result");
  const zipResultName = document.getElementById("zip-result-name");
  const zipResultEta = document.getElementById("zip-result-eta");

  // Show all cards naturally
  const showAllCards = () => {
    cards.forEach((card) => {
      card.style.display = "";
      card.classList.remove("gmap-card-collapsed");
    });
    if (toggleAllBtn) {
      toggleAllBtn.style.display = "none";
    }
    if (countTag) {
      countTag.textContent = `Showing all ${cards.length} service hubs`;
    }
  };

  // Run initial state
  showAllCards();

  // 1. Accordion Drawer toggle on cards
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

    // Clicking anywhere on card outside direct links/buttons
    card.addEventListener("click", (e) => {
      if (e.target.closest("a") || e.target.closest("button") || e.target.closest(".gmap-hood-chip")) return;
      toggle();
    });

    // 2. Chip click action -> direct call to dispatch
    const chips = card.querySelectorAll(".gmap-hood-chip");
    chips.forEach((chip) => {
      chip.addEventListener("click", (e) => {
        e.stopPropagation();
        window.location.href = "tel:9412889768";
      });
    });
  });

  // 3. Live Search & Filter Bar
  const filterCards = (query) => {
    const q = (query || "").toLowerCase().trim();
    let matchCount = 0;

    if (!q) {
      showAllCards();
      if (clearBtn) clearBtn.hidden = true;
      return;
    }

    // Query active: filter cards by query
    cards.forEach((card) => {
      card.classList.remove("gmap-card-collapsed");
      const textContent = (card.textContent || "").toLowerCase();
      const keywords = (card.getAttribute("data-keywords") || "").toLowerCase();
      const isMatch = textContent.includes(q) || keywords.includes(q);

      card.style.display = isMatch ? "flex" : "none";

      if (isMatch) {
        matchCount++;
        // Auto-expand drawer on matches for direct neighborhood visibility
        const collapsePanel = card.querySelector(".gmap-hoods-collapse");
        const toggleBtn = card.querySelector(".gmap-hoods-toggle");
        if (collapsePanel && toggleBtn) {
          collapsePanel.classList.add("is-open");
          toggleBtn.setAttribute("aria-expanded", "true");
        }
      }
    });

    if (toggleAllBtn) {
      toggleAllBtn.style.display = "none";
    }

    if (clearBtn) {
      clearBtn.hidden = false;
    }

    if (countTag) {
      if (matchCount === 0) {
        countTag.textContent = `0 matches for "${query}" — Call 941-288-9768 for any Sarasota ZIP`;
      } else {
        countTag.textContent = `Found ${matchCount} matching hub${matchCount > 1 ? "s" : ""} in service area`;
      }
    }
  };

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      filterCards(e.target.value);
    });

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        searchInput.value = "";
        zipPills.forEach((p) => p.classList.remove("active"));
        if (zipResult) zipResult.classList.remove("is-active");
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

  // 4. Interactive ZIP Code Coverage Pills
  zipPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      const zip = pill.getAttribute("data-zip") || "";
      const zone = pill.getAttribute("data-zone") || zip;
      const eta = pill.getAttribute("data-eta") || "10-15 min";

      zipPills.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");

      if (zip === "all") {
        if (searchInput) searchInput.value = "";
        showAllCards();
        if (clearBtn) clearBtn.hidden = true;
        if (zipResult) {
          if (zipResultName) zipResultName.textContent = "All Sarasota County Service Hubs";
          if (zipResultEta) zipResultEta.textContent = "Same-Day Priority Mobile Response";
          zipResult.classList.add("is-active");
        }
      } else {
        if (searchInput) searchInput.value = zip;
        filterCards(zip);
        if (zipResult) {
          if (zipResultName) zipResultName.textContent = `${zone} (${zip})`;
          if (zipResultEta) zipResultEta.textContent = eta;
          zipResult.classList.add("is-active");
        }
      }
    });
  });
}

/* Fast 2-Field Callback Request Widget */
function initQuickCallbackForm() {
  const form = document.getElementById("quick-callback-form");
  const successBox = document.getElementById("callback-success");
  const submitBtn = document.getElementById("callback-submit-btn");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const phoneInput = form.querySelector("#callback-phone");
    const issueSelect = form.querySelector("#callback-issue");
    const phone = phoneInput ? phoneInput.value.trim() : "";
    const issue = issueSelect && issueSelect.value ? issueSelect.value : "Dryer Service Request";

    // Strict validation
    const digitsOnly = phone.replace(/\D/g, "");
    if (digitsOnly.length < 10) {
      if (phoneInput) {
        phoneInput.focus();
        phoneInput.setCustomValidity("Please enter a valid 10-digit phone number (e.g. 941-288-9768).");
        phoneInput.reportValidity();
      }
      return;
    }
    if (phoneInput) phoneInput.setCustomValidity("");

    const originalBtnText = submitBtn ? submitBtn.innerHTML : "Request Callback";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = "Submitting request...";
    }

    const cfg = leadsConfig();
    const payload = {
      phone: phone,
      issue: issue,
      pageUrl: window.location.href,
      formType: "quick_callback",
      timestamp: new Date().toISOString()
    };

    let submissionConfirmed = false;
    if (cfg && cfg.apiBase && cfg.siteId) {
      try {
        const response = await fetch(cfg.apiBase + "/api/leads/" + encodeURIComponent(cfg.siteId), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true
        });
        if (response.ok) {
          submissionConfirmed = true;
        }
      } catch (_err) {
        submissionConfirmed = false;
      }
    }

    if (submissionConfirmed) {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = "Request Submitted ✓";
        submitBtn.style.background = "#059669";
      }
      if (successBox) {
        // Safe DOM manipulation - avoid innerHTML with unescaped input
        while (successBox.firstChild) {
          successBox.removeChild(successBox.firstChild);
        }
        const strong = document.createElement("strong");
        strong.textContent = "Callback Request Submitted. ";
        const text1 = document.createTextNode("A local Sarasota dispatcher has received your inquiry for ");
        const phoneStrong = document.createElement("strong");
        phoneStrong.textContent = phone;
        const text2 = document.createTextNode(" regarding " + issue + ". We will review your unit details and contact you promptly.");

        successBox.style.color = "";
        successBox.style.borderColor = "";
        successBox.appendChild(strong);
        successBox.appendChild(text1);
        successBox.appendChild(phoneStrong);
        successBox.appendChild(text2);
        successBox.classList.add("is-visible");
      }
    } else {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      }
      if (successBox) {
        while (successBox.firstChild) {
          successBox.removeChild(successBox.firstChild);
        }
        const errStrong = document.createElement("strong");
        errStrong.textContent = "Notice: ";
        const errText = document.createTextNode(
          "We could not confirm online submission at this moment. Please call our Sarasota dispatch desk directly at 941 288 9768 for immediate scheduling."
        );
        successBox.style.color = "#b91c1c";
        successBox.style.borderColor = "#f87171";
        successBox.appendChild(errStrong);
        successBox.appendChild(errText);
        successBox.classList.add("is-visible");
      }
    }
  });
}

/* Contact Page Service Request Form Handler */
function initContactServiceForm() {
  const form = document.getElementById("contact-service-form");
  const statusBox = document.getElementById("contact-form-status");
  const submitBtn = document.getElementById("contact-submit-btn");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nameInput = form.querySelector("#contact-name");
    const phoneInput = form.querySelector("#contact-phone");
    const locInput = form.querySelector("#contact-location");
    const issueSelect = form.querySelector("#contact-issue");
    const notesInput = form.querySelector("#contact-notes");

    const name = nameInput ? nameInput.value.trim() : "";
    const phone = phoneInput ? phoneInput.value.trim() : "";
    const neighborhood = locInput ? locInput.value.trim() : "";
    const issue = issueSelect && issueSelect.value ? issueSelect.value : "General Dryer Repair";
    const notes = notesInput ? notesInput.value.trim() : "";

    const digitsOnly = phone.replace(/\D/g, "");
    if (digitsOnly.length < 10) {
      if (phoneInput) {
        phoneInput.focus();
        phoneInput.setCustomValidity("Please enter a valid 10-digit phone number (e.g. 941-288-9768).");
        phoneInput.reportValidity();
      }
      return;
    }
    if (phoneInput) phoneInput.setCustomValidity("");

    const originalBtnText = submitBtn ? submitBtn.innerHTML : "Submit Service Request";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = "Submitting request...";
    }

    const cfg = leadsConfig();
    const payload = {
      name: name,
      phone: phone,
      neighborhood: neighborhood,
      issue: issue,
      notes: notes,
      pageUrl: window.location.href,
      formType: "contact_page",
      timestamp: new Date().toISOString()
    };

    let confirmed = false;
    if (cfg && cfg.apiBase && cfg.siteId) {
      try {
        const response = await fetch(cfg.apiBase + "/api/leads/" + encodeURIComponent(cfg.siteId), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true
        });
        if (response.ok) {
          confirmed = true;
        }
      } catch (_err) {
        confirmed = false;
      }
    }

    if (confirmed) {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = "Request Received ✓";
        submitBtn.style.background = "#059669";
      }
      if (statusBox) {
        while (statusBox.firstChild) {
          statusBox.removeChild(statusBox.firstChild);
        }
        const strong = document.createElement("strong");
        strong.textContent = "Thank you! ";
        const txt = document.createTextNode("Your service request has been received. Our Sarasota dispatch desk will contact you at " + phone + " promptly.");
        statusBox.style.display = "block";
        statusBox.style.color = "#065f46";
        statusBox.style.border = "1px solid #10b981";
        statusBox.appendChild(strong);
        statusBox.appendChild(txt);
      }
      form.reset();
    } else {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      }
      if (statusBox) {
        while (statusBox.firstChild) {
          statusBox.removeChild(statusBox.firstChild);
        }
        const strong = document.createElement("strong");
        strong.textContent = "Notice: ";
        const txt = document.createTextNode("Unable to confirm online submission at this moment. Please call our Sarasota dispatch desk directly at 941 288 9768.");
        statusBox.style.display = "block";
        statusBox.style.color = "#b91c1c";
        statusBox.style.border = "1px solid #f87171";
        statusBox.appendChild(strong);
        statusBox.appendChild(txt);
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initOfferCodes();
  initNewsletter();
  initLeadForms();
  initReveal();
  initLandmarkNeighborhoods();
  initQuickCallbackForm();
  initContactServiceForm();
});


