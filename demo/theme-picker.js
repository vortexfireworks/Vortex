/* theme-picker.js — CueSheet demo only.
   Lets a prospective client try a different accent color live, without
   touching layout or the dark/light switch. Choice is saved per-browser
   (localStorage) and reapplied on every page since this script is included
   on all of them. Pure visual override: sets a handful of CSS custom
   properties as inline styles on <html>, which win over each page's own
   :root rules regardless of load order. Safe no-op on pages that don't use
   a given variable.
*/
(function () {
  "use strict";

  var STORAGE_KEY = "pyroAccent";

  var PRESETS = {
    indigo: {
      label: "Indigo",
      swatch: "#6366F1",
      dark: {
        accent1: "#4F46E5", accent2: "#8B5CF6", accent3: "#22D3EE",
        navy: "#A5B4FC", brick: "#6366F1", "brick-light": "#818CF8",
        kicker: "#A5B4FC",
        "title-gradient": "linear-gradient(90deg,#6366F1 0%,#8B5CF6 30%,#22D3EE 50%,#60A5FA 75%,#818CF8 100%)",
        "divider-glow": "rgba(139,92,246,0.4)"
      },
      light: {
        accent1: "#4F46E5", accent2: "#8B5CF6", accent3: "#22D3EE",
        navy: "#4F46E5", brick: "#4F46E5", "brick-light": "#6366F1",
        kicker: "#4F46E5",
        "title-gradient": "linear-gradient(90deg,#4F46E5 0%,#7C3AED 30%,#0891B2 50%,#3B82F6 75%,#312E81 100%)",
        "divider-glow": "rgba(139,92,246,0.3)"
      }
    },
    teal: {
      label: "Teal",
      swatch: "#0D9488",
      dark: {
        accent1: "#0D9488", accent2: "#14B8A6", accent3: "#67E8F9",
        navy: "#5EEAD4", brick: "#0D9488", "brick-light": "#2DD4BF",
        kicker: "#5EEAD4",
        "title-gradient": "linear-gradient(90deg,#0D9488 0%,#14B8A6 30%,#67E8F9 50%,#38BDF8 75%,#2DD4BF 100%)",
        "divider-glow": "rgba(20,184,166,0.4)"
      },
      light: {
        accent1: "#0F766E", accent2: "#0D9488", accent3: "#0891B2",
        navy: "#0F766E", brick: "#0F766E", "brick-light": "#0D9488",
        kicker: "#0F766E",
        "title-gradient": "linear-gradient(90deg,#0F766E 0%,#0D9488 30%,#0891B2 50%,#2563EB 75%,#1E3A8A 100%)",
        "divider-glow": "rgba(13,148,136,0.3)"
      }
    },
    rose: {
      label: "Rose",
      swatch: "#E11D48",
      dark: {
        accent1: "#BE123C", accent2: "#E11D48", accent3: "#FB7185",
        navy: "#FDA4AF", brick: "#E11D48", "brick-light": "#FB7185",
        kicker: "#FDA4AF",
        "title-gradient": "linear-gradient(90deg,#BE123C 0%,#E11D48 30%,#FB7185 50%,#FB923C 75%,#FBBF24 100%)",
        "divider-glow": "rgba(225,29,72,0.4)"
      },
      light: {
        accent1: "#9F1239", accent2: "#BE123C", accent3: "#E11D48",
        navy: "#9F1239", brick: "#9F1239", "brick-light": "#BE123C",
        kicker: "#9F1239",
        "title-gradient": "linear-gradient(90deg,#9F1239 0%,#BE123C 30%,#E11D48 50%,#EA580C 75%,#B45309 100%)",
        "divider-glow": "rgba(190,18,60,0.3)"
      }
    },
    amber: {
      label: "Amber",
      swatch: "#D97706",
      dark: {
        accent1: "#B45309", accent2: "#D97706", accent3: "#FBBF24",
        navy: "#FCD34D", brick: "#D97706", "brick-light": "#F59E0B",
        kicker: "#FCD34D",
        "title-gradient": "linear-gradient(90deg,#B45309 0%,#D97706 30%,#FBBF24 50%,#34D399 75%,#2DD4BF 100%)",
        "divider-glow": "rgba(217,119,6,0.4)"
      },
      light: {
        accent1: "#92400E", accent2: "#B45309", accent3: "#D97706",
        navy: "#92400E", brick: "#92400E", "brick-light": "#B45309",
        kicker: "#92400E",
        "title-gradient": "linear-gradient(90deg,#92400E 0%,#B45309 30%,#D97706 50%,#047857 75%,#065F46 100%)",
        "divider-glow": "rgba(180,83,9,0.3)"
      }
    }
  };

  function currentMode() {
    return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  }

  function apply(key) {
    var preset = PRESETS[key] || PRESETS.indigo;
    var vals = preset[currentMode()];
    var root = document.documentElement.style;
    Object.keys(vals).forEach(function (name) {
      root.setProperty("--" + name, vals[name]);
    });
  }

  function savedKey() {
    try {
      return localStorage.getItem(STORAGE_KEY) || "indigo";
    } catch (e) {
      return "indigo";
    }
  }

  function save(key) {
    try { localStorage.setItem(STORAGE_KEY, key); } catch (e) {}
  }

  // Apply immediately (before paint where possible) so there's no flash.
  apply(savedKey());

  // Re-apply whenever the page's own light/dark toggle flips, since the
  // override values differ per mode. Pages flip data-theme via a plain
  // attribute set, so a MutationObserver catches it generically.
  new MutationObserver(function () {
    apply(savedKey());
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  function buildUI() {
    var wrap = document.createElement("div");
    wrap.setAttribute("aria-label", "Demo color theme");
    wrap.style.cssText =
      "position:fixed;right:16px;bottom:16px;z-index:99999;font-family:system-ui,sans-serif;";

    var btn = document.createElement("button");
    btn.type = "button";
    btn.title = "Try a different accent color (demo only)";
    btn.textContent = "🎨";
    btn.style.cssText =
      "width:44px;height:44px;border-radius:50%;border:1px solid rgba(128,128,128,0.35);" +
      "background:rgba(30,30,40,0.85);color:#fff;font-size:18px;cursor:pointer;" +
      "box-shadow:0 2px 10px rgba(0,0,0,0.25);backdrop-filter:blur(6px);";

    var panel = document.createElement("div");
    panel.style.cssText =
      "display:none;position:absolute;right:0;bottom:54px;padding:10px;border-radius:12px;" +
      "background:rgba(20,20,28,0.95);box-shadow:0 8px 24px rgba(0,0,0,0.35);" +
      "gap:8px;flex-direction:column;min-width:150px;backdrop-filter:blur(6px);";

    var title = document.createElement("div");
    title.textContent = "Accent color";
    title.style.cssText = "color:#e5e7eb;font-size:11px;letter-spacing:0.5px;margin-bottom:2px;";
    panel.appendChild(title);

    var row = document.createElement("div");
    row.style.cssText = "display:flex;gap:8px;";
    Object.keys(PRESETS).forEach(function (key) {
      var preset = PRESETS[key];
      var swatch = document.createElement("button");
      swatch.type = "button";
      swatch.title = preset.label;
      swatch.style.cssText =
        "width:26px;height:26px;border-radius:50%;cursor:pointer;background:" +
        preset.swatch + ";border:2px solid " + (key === savedKey() ? "#fff" : "transparent") + ";";
      swatch.addEventListener("click", function () {
        save(key);
        apply(key);
        Array.prototype.forEach.call(row.children, function (c) {
          c.style.borderColor = "transparent";
        });
        swatch.style.borderColor = "#fff";
      });
      row.appendChild(swatch);
    });
    panel.appendChild(row);

    btn.addEventListener("click", function () {
      panel.style.display = panel.style.display === "flex" ? "none" : "flex";
    });
    document.addEventListener("click", function (e) {
      if (!wrap.contains(e.target)) panel.style.display = "none";
    });

    wrap.appendChild(panel);
    wrap.appendChild(btn);
    document.body.appendChild(wrap);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildUI);
  } else {
    buildUI();
  }
})();
