/*
 * pleger-linkedin-card.bundle.js — v1.0.0
 * Tarjeta de LinkedIn personalizada para Ghost, HTML y otros sitios.
 * Todo el CSS y el fondo SVG están incluidos en este archivo.
 * El logo PNG se carga desde la URL definida en logoUrl.
 * Uso automático: <div data-pleger-linkedin-card></div>
 *                 <script defer src=".../pleger-linkedin-card.bundle.js"></script>
 * Uso manual: PlegerLinkedInCard.init({ target: '#mi-tarjeta' });
 */
(function (global) {
  'use strict';

  const STYLE = String.raw`:host { display: block; width: 100%; }
/* Estilos encapsulados: prefijo plli- para evitar conflictos con pleger.cl. */
.plli-card, .plli-card * { box-sizing: border-box; }

.plli-card {
  --plli-blue: #0a66c2;
  display: block;
  width: 100%;
  max-width: 780px;
  min-height: 220px;
  position: relative;
  isolation: isolate;
  overflow: hidden;
  padding: clamp(22px, 4vw, 34px);
  border-radius: 22px;
  border: 1px solid rgba(77, 147, 184, .3);
  text-decoration: none;
  color: #152b41;
  font-family: inherit;
  background-color: #e7f3fa;
  background-image:
    radial-gradient(ellipse at 48% 5%, rgba(255,255,255,.96), transparent 58%),
    radial-gradient(ellipse at 100% 95%, rgba(112,190,229,.28), transparent 55%),
    linear-gradient(110deg, rgba(223,241,251,.92), rgba(251,254,255,.96) 55%, rgba(216,237,248,.95));
  background-size: cover, cover, cover;
  background-position: center;
  box-shadow: 0 13px 32px rgba(28,80,111,.12), 0 2px 7px rgba(24,78,109,.06);
  transition: transform .24s ease, box-shadow .24s ease, border-color .24s ease;
}

/* El dibujo vectorial debe ser visible encima del degradado. */
.plli-card::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMTAwIiBoZWlnaHQ9IjM1MCIgdmlld0JveD0iMCAwIDExMDAgMzUwIj4KIDxnIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzYyOUZDNCIgc3Ryb2tlLXdpZHRoPSIxLjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgb3BhY2l0eT0iLjQyIj4KICA8cGF0aCBkPSJNMCAwIDEzNSAwIDIxMCA4MiAxNDAgMTY4IDE4IDEyOSAwIDUyTTAgMCA3NiA2NSAxOCAxMjkgMCAyMzVNMTM1IDAgNzYgNjUgMTQwIDE2OCAyMTAgODIgMjk0IDBNNzYgNjUgMCA1Mk0xNDAgMTY4IDU4IDI1MCAwIDIzNU01OCAyNTAgMTQwIDE2OCAyMTAgMjYyIDEzMiAzNTBNMCAzNTAgNTggMjUwIDEzMiAzNTAiLz4KICA8cGF0aCBkPSJNMTEwMCAwIDEwMDUgMCA5NTAgODggMTAyNSAxNjQgMTEwMCAxMTJNMTAwNSAwIDEwMjUgMTY0IDExMDAgMTJNOTUwIDg4IDg3NCAxMCA3ODggNzIgODUyIDE3NiAxMDI1IDE2NE03ODggNzIgNzQ2IDBNODUyIDE3NiA4MDIgMjgyIDk1NSAzNTAgMTAyNSAxNjQgMTEwMCAyMjlNMTEwMCAzNTAgOTU1IDM1MCAxMTAwIDIyOU04MDIgMjgyIDcyMiAzNTAiLz4KICA8cGF0aCBkPSJNMjcwIDAgMzEyIDU1IDM4NyAwTTYzOCAzNTAgNjc5IDMwMCA3MjcgMzUwIiBvcGFjaXR5PSIuMzUiIC8+CiA8L2c+CiA8ZyBmaWxsPSIjNzVBQ0M5IiBvcGFjaXR5PSIuMzUiPjxjaXJjbGUgY3g9IjE0MCIgY3k9IjE2OCIgcj0iMyIvPjxjaXJjbGUgY3g9IjIxMCIgY3k9IjgyIiByPSIyLjUiLz48Y2lyY2xlIGN4PSI5NTAiIGN5PSI4OCIgcj0iMyIvPjxjaXJjbGUgY3g9Ijg1MiIgY3k9IjE3NiIgcj0iMi41Ii8+PGNpcmNsZSBjeD0iODAyIiBjeT0iMjgyIiByPSIyLjIiLz48L2c+Cjwvc3ZnPg==") center / cover no-repeat;
  opacity: .86;
}

.plli-card::after {
  content: "";
  position: absolute;
  right: -58px;
  top: -95px;
  width: 280px;
  height: 280px;
  border-radius: 50%;
  pointer-events: none;
  z-index: -1;
  background: radial-gradient(circle, rgba(93,180,228,.22) 0%, transparent 70%);
}

.plli-card:hover {
  transform: translateY(-4px);
  border-color: rgba(10,102,194,.55);
  box-shadow: 0 20px 42px rgba(28,80,111,.18), 0 3px 9px rgba(24,78,109,.09);
}
.plli-card:focus-visible { outline: 3px solid #0a66c2; outline-offset: 4px; }
.plli-card:visited { color: #152b41; }

.plli-card__content {
  display: flex;
  align-items: center;
  gap: clamp(22px, 4vw, 34px);
  min-height: 152px;
  position: relative;
  z-index: 1;
}
.plli-card__avatar {
  width: 128px;
  height: 128px;
  flex: 0 0 128px;
  display: grid;
  place-items: center;
  padding: 16px;
  border: 1px solid rgba(66,114,143,.23);
  border-radius: 27px;
  background: rgba(255,255,255,.76);
  box-shadow: 0 7px 22px rgba(32,85,116,.1), inset 0 1px 0 rgba(255,255,255,.9);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}
.plli-card__logo { display: block; width: 100%; height: 100%; object-fit: contain; }
.plli-card__body { min-width: 0; flex: 1; }
.plli-card__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  line-height: 1.3;
  text-transform: uppercase;
  letter-spacing: .17em;
  font-weight: 800;
  color: #26739f;
}
.plli-card__eyebrow::before {
  content: "";
  width: 7px;
  height: 7px;
  background: #14a1d1;
  border-radius: 50%;
  box-shadow: 0 0 0 4px rgba(20,161,209,.13);
}
.plli-card__name {
  margin: 12px 0 6px;
  padding: 0;
  color: #162e45;
  font-size: clamp(26px, 3.5vw, 34px);
  line-height: 1.15;
  letter-spacing: -.035em;
  font-weight: 750;
}
.plli-card__role {
  margin: 0;
  color: #416178;
  font-size: clamp(14px, 1.85vw, 16px);
  line-height: 1.4;
}
.plli-card__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 13px 20px;
  margin-top: 22px;
}
.plli-card__affiliation {
  font-size: 12px;
  line-height: 1.5;
  color: #58798d;
}
.plli-card__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  margin-left: auto;
  padding: 9px 14px 9px 10px;
  border-radius: 999px;
  background: #0a66c2;
  color: #fff;
  font-size: 12px;
  line-height: 1.2;
  font-weight: 750;
  white-space: nowrap;
  box-shadow: 0 5px 15px rgba(10,102,194,.2);
  transition: background .2s ease, box-shadow .2s ease;
}
.plli-card:hover .plli-card__action { background: #0756a5; box-shadow: 0 8px 19px rgba(10,102,194,.27); }
.plli-card__in {
  display: inline-grid;
  place-items: center;
  width: 23px;
  height: 23px;
  border-radius: 4px;
  background: #fff;
  color: #0a66c2;
  font-size: 16px;
  font-weight: 900;
  letter-spacing: -.06em;
  font-family: Arial, Helvetica, sans-serif;
}
.plli-card__arrow { display: inline-block; font-size: 17px; transition: transform .2s ease; }
.plli-card:hover .plli-card__arrow { transform: translate(2px,-2px); }

@media (max-width: 660px) {
  .plli-card { min-height: 0; padding: 22px; }
  .plli-card__content { gap: 18px; align-items: flex-start; }
  .plli-card__avatar { width: 87px; height: 87px; flex-basis: 87px; border-radius: 20px; padding: 12px; }
  .plli-card__name { margin-top: 8px; }
  .plli-card__footer { margin-top: 16px; }
  .plli-card__action { margin-left: 0; }
}
@media (max-width: 430px) {
  .plli-card__content { display: block; }
  .plli-card__avatar { margin-bottom: 15px; }
  .plli-card__action { margin-top: 3px; }
}
@media (prefers-reduced-motion: reduce) {
  .plli-card, .plli-card__action, .plli-card__arrow { transition: none; }
  .plli-card:hover { transform: none; }
}
`;

  const DEFAULTS = Object.freeze({
    target: '[data-pleger-linkedin-card]',
    name: 'Paul Leger',
    role: 'Associate Professor · Computer Science',
    affiliation: 'Universidad Católica del Norte · Chile',
    eyebrow: 'Professional network',
    actionText: 'View LinkedIn profile',
    profileUrl: 'https://www.linkedin.com/in/plegerm/',
    logoUrl: 'https://pleger.github.io/assets/icons/logo_paul.png',
    newTab: true
  });

  function el(tag, cls, value) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (value !== undefined) n.textContent = value;
    return n;
  }

  // Crea la tarjeta sin innerHTML para tratar los textos como datos, no como HTML.
  function createCard(c) {
    const a = el('a', 'plli-card');
    a.href = c.profileUrl;
    a.setAttribute('aria-label', c.name + ' — LinkedIn' + (c.newTab ? ' (abre en una pestaña nueva)' : ''));
    if (c.newTab) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }

    const content = el('div', 'plli-card__content');
    const avatar = el('div', 'plli-card__avatar');
    const logo = el('img', 'plli-card__logo');
    logo.src = c.logoUrl;
    logo.alt = '';
    logo.width = 88;
    logo.height = 88;
    logo.loading = 'lazy';
    logo.decoding = 'async';
    avatar.appendChild(logo);

    const body = el('div', 'plli-card__body');
    const eyebrow = el('span', 'plli-card__eyebrow', c.eyebrow);
    const name = el('h3', 'plli-card__name', c.name);
    const role = el('p', 'plli-card__role', c.role);
    const footer = el('div', 'plli-card__footer');
    const affiliation = el('span', 'plli-card__affiliation', c.affiliation);
    const action = el('span', 'plli-card__action');
    const brand = el('span', 'plli-card__in', 'in');
    brand.setAttribute('aria-hidden', 'true');
    const label = el('span', '', c.actionText);
    const arrow = el('span', 'plli-card__arrow', '↗');
    arrow.setAttribute('aria-hidden', 'true');
    action.append(brand, label, arrow);
    footer.append(affiliation, action);
    body.append(eyebrow, name, role, footer);
    content.append(avatar, body);
    a.appendChild(content);
    return a;
  }

  function init(options) {
    const c = Object.assign({}, DEFAULTS, options || {});
    const target = typeof c.target === 'string' ? document.querySelector(c.target) : c.target;
    if (!target || !target.attachShadow) {
      console.warn('[PlegerLinkedInCard] No se encontró un contenedor válido:', c.target);
      return null;
    }

    // Shadow DOM evita que las reglas CSS de Ghost alteren la tarjeta.
    const shadow = target.shadowRoot || target.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = STYLE;
    const card = createCard(c);
    shadow.replaceChildren(style, card);
    return card;
  }

  function autoInit() {
    document.querySelectorAll('[data-pleger-linkedin-card]').forEach(function (target) {
      if (target.shadowRoot) return; // Evita duplicar una tarjeta ya inicializada.
      const d = target.dataset;
      init({
        target: target,
        name: d.name || DEFAULTS.name,
        role: d.role || DEFAULTS.role,
        affiliation: d.affiliation || DEFAULTS.affiliation,
        eyebrow: d.eyebrow || DEFAULTS.eyebrow,
        actionText: d.actionText || DEFAULTS.actionText,
        profileUrl: d.profileUrl || DEFAULTS.profileUrl,
        logoUrl: d.logoUrl || DEFAULTS.logoUrl,
        newTab: d.newTab === undefined ? DEFAULTS.newTab : d.newTab !== 'false'
      });
    });
  }

  global.PlegerLinkedInCard = Object.freeze({ init: init, autoInit: autoInit, defaults: DEFAULTS });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit, { once: true });
  } else {
    autoInit();
  }
})(window);
