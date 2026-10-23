
/*
 * Pleger LinkedIn Card v1.1.1
 * JavaScript + CSS + SVG en un solo archivo.
 */
(function () {
  'use strict';

  const DEFAULTS = {
    name: 'Paul Leger',
    role: 'Associate Professor · Computer Science',
    affiliation: 'Universidad Católica del Norte · Chile',
    eyebrow: 'Professional network',
    actionText: 'View LinkedIn profile',
    profileUrl: 'https://www.linkedin.com/in/plegerm/',
    logoUrl: 'https://pleger.github.io/assets/icons/logo_paul.png',
    cardWidth: '690px',
    cardPadding: '25px',
    affiliationFontSize: '14px'
  };

  // Fondo SVG integrado.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="350" viewBox="0 0 1100 350"><g fill="none" stroke="#629fc4" stroke-width="1.2" opacity=".38"><path d="M0 0 135 0 210 82 140 168 18 129 0 52M0 0 76 65 18 129 0 235M135 0 76 65 140 168 210 82 294 0M140 168 58 250 0 235M58 250 140 168 210 262 132 350M0 350 58 250 132 350"/><path d="M1100 0 1005 0 950 88 1025 164 1100 112M1005 0 1025 164 1100 12M950 88 874 10 788 72 852 176 1025 164M852 176 802 282 955 350 1025 164 1100 229M1100 350 955 350 1100 229M802 282 722 350"/></g></svg>`;

  const bg = 'url("data:image/svg+xml,' +
             encodeURIComponent(svg) + '")';

  const css = `
    :host {
      display: block;
      width: 100%;
    }

    *, *::before, *::after {
      box-sizing: border-box;
    }

    a.card {
      display: block;
      position: relative;
      isolation: isolate;
      overflow: hidden;
      width: 100%;
      max-width: var(--card-width, 690px);
      min-height: 195px;
      margin: 0 auto;
      padding: var(--card-padding, 25px);
      border: 1px solid #a9cee1;
      border-radius: 22px;
      background:
        radial-gradient(
          ellipse at 45% 0,
          #fff,
          transparent 65%
        ),
        linear-gradient(
          110deg,
          #dceefa,
          #fafdff 52%,
          #d5ebf8
        );
      color: #162e45;
      text-decoration: none;
      font-family: Arial, Helvetica, sans-serif;
      box-shadow: 0 13px 32px #1c506f1f;
      transition:
        transform .22s ease,
        box-shadow .22s ease;
    }

    a.card::before {
      content: '';
      position: absolute;
      inset: 0;
      z-index: -1;
      background-image: __BACKGROUND__;
      background-position: center;
      background-size: cover;
      pointer-events: none;
    }

    a.card:hover {
      transform: translateY(-3px);
      box-shadow: 0 18px 40px #1c506f30;
    }

    a.card:focus-visible {
      outline: 3px solid #0a66c2;
      outline-offset: 3px;
    }

    .content {
      display: flex;
      gap: 25px;
      align-items: center;
      min-height: 135px;
    }

    .avatar {
      flex: 0 0 112px;
      width: 112px;
      height: 112px;
      padding: 14px;
      display: grid;
      place-items: center;
      border-radius: 24px;
      background: #ffffffd9;
      border: 1px solid #bfd7e4;
      box-shadow: 0 6px 20px #20557419;
    }

    .avatar img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .body {
      flex: 1;
      min-width: 0;
    }

    .eyebrow {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: .16em;
      text-transform: uppercase;
      color: #26739f;
    }

    .eyebrow::before {
      content: '●';
      color: #14a1d1;
      margin-right: 8px;
    }

    h3 {
      margin: 11px 0 6px;
      font-size: clamp(25px, 3.5vw, 32px);
      line-height: 1.15;
      letter-spacing: -.03em;
      color: #162e45;
    }

    .role {
      margin: 0;
      font-size: 15px;
      line-height: 1.4;
      color: #416178;
    }

    .footer {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 17px;
    }

    .affiliation {
      color: #58798d;
      line-height: 1.5;
      font-size: var(--affiliation-size, 14px);
    }

    .action {
      display: inline-flex;
      gap: 9px;
      align-items: center;
      margin-left: auto;
      padding: 10px 13px;
      border-radius: 100px;
      background: #0a66c2;
      color: white;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
    }

    .in {
      display: inline-grid;
      place-items: center;
      width: 22px;
      height: 22px;
      border-radius: 4px;
      background: #fff;
      color: #0a66c2;
      font-size: 15px;
      font-weight: 900;
    }

    @media (max-width: 660px) {
      a.card {
        min-height: 0;
      }

      .content {
        align-items: flex-start;
        gap: 18px;
      }

      .avatar {
        flex-basis: 82px;
        width: 82px;
        height: 82px;
        padding: 10px;
      }

      .action {
        margin-left: 0;
      }
    }

    @media (max-width: 430px) {
      .content {
        display: block;
      }

      .avatar {
        margin-bottom: 15px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      a.card {
        transition: none;
      }

      a.card:hover {
        transform: none;
      }
    }
  `.replace('__BACKGROUND__', bg);

  // Valida medidas CSS configurables.
  function length(value, fallback) {
    const s = String(value || '').trim();
    return /^\d+(?:\.\d+)?(px|rem|em|%)$/.test(s)
      ? s
      : fallback;
  }

  function elem(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function init(options = {}) {
    const target = typeof options.target === 'string'
      ? document.querySelector(options.target)
      : options.target;

    if (!target) return null;

    const c = Object.assign({}, DEFAULTS, options);
    const root = target.shadowRoot ||
      target.attachShadow({mode: 'open'});

    const style = elem('style');
    style.textContent = css;

    const card = elem('a', 'card');
    card.href = c.profileUrl;
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
    card.setAttribute(
      'aria-label',
      'Ver perfil de ' + c.name + ' en LinkedIn'
    );

    card.style.setProperty(
      '--card-width',
      length(c.cardWidth, '690px')
    );
    card.style.setProperty(
      '--card-padding',
      length(c.cardPadding, '25px')
    );
    card.style.setProperty(
      '--affiliation-size',
      length(c.affiliationFontSize, '14px')
    );

    const content = elem('div', 'content');
    const avatar = elem('div', 'avatar');

    const img = elem('img');
    img.src = c.logoUrl;
    img.alt = '';
    img.loading = 'lazy';
    avatar.append(img);

    const body = elem('div', 'body');
    const eyebrow = elem('div', 'eyebrow', c.eyebrow);
    const name = elem('h3', '', c.name);
    const role = elem('p', 'role', c.role);

    const footer = elem('div', 'footer');
    const affiliation = elem(
      'span',
      'affiliation',
      c.affiliation
    );

    const action = elem('span', 'action');
    action.append(
      elem('span', 'in', 'in'),
      elem('span', '', c.actionText),
      elem('span', '', '↗')
    );

    footer.append(affiliation, action);
    body.append(eyebrow, name, role, footer);
    content.append(avatar, body);
    card.append(content);

    root.replaceChildren(style, card);

    return card;
  }

  function autoInit() {
    document
      .querySelectorAll('[data-pleger-linkedin-card]')
      .forEach(target => {
        if (target.shadowRoot) return;

        const d = target.dataset;

        init({
          target,
          name: d.name || DEFAULTS.name,
          role: d.role || DEFAULTS.role,
          affiliation: d.affiliation || DEFAULTS.affiliation,
          eyebrow: d.eyebrow || DEFAULTS.eyebrow,
          actionText: d.actionText || DEFAULTS.actionText,
          profileUrl: d.profileUrl || DEFAULTS.profileUrl,
          logoUrl: d.logoUrl || DEFAULTS.logoUrl,
          cardWidth: d.cardWidth || DEFAULTS.cardWidth,
          cardPadding: d.cardPadding || DEFAULTS.cardPadding,
          affiliationFontSize:
            d.affiliationFontSize ||
            DEFAULTS.affiliationFontSize
        });
      });
  }

  window.PlegerLinkedInCard = { init, autoInit };

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      autoInit,
      {once: true}
    );
  } else {
    autoInit();
  }
})();
