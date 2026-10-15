// reorder.js — lets each crew member drag the cards on a menu page into
// whatever order works for them. The order is saved to this device only
// (localStorage), per page and per card group, and never touches the
// backend — nothing here is shared between people or devices.
//
// Drop <script src="reorder.js"></script> on any page that has one or more
// <div class="cards">...<a class="card ...">...</a>...</div> groups, and
// this sets itself up automatically: it restores any saved order on load,
// and adds an "Edit layout" toggle button that turns on drag handles.
(function(){
  function storageKeyFor(index){
    return 'cardOrder::' + location.pathname.split('/').pop() + '::' + index;
  }

  function cardKey(card){
    return card.getAttribute('href') || '';
  }

  function cardsIn(container){
    return Array.from(container.querySelectorAll(':scope > a.card'));
  }

  function applySavedOrder(container, key){
    let saved;
    try{ saved = JSON.parse(localStorage.getItem(key) || 'null'); }catch(e){ saved = null; }
    if(!saved || !Array.isArray(saved) || !saved.length) return;
    const cards = cardsIn(container);
    const byKey = new Map();
    cards.forEach(c => byKey.set(cardKey(c), c));
    const used = new Set();
    saved.forEach(k => {
      const c = byKey.get(k);
      if(c && !used.has(k)){ container.appendChild(c); used.add(k); }
    });
    cards.forEach(c => {
      const k = cardKey(c);
      if(!used.has(k)){ container.appendChild(c); used.add(k); }
    });
  }

  function saveOrder(container, key){
    try{ localStorage.setItem(key, JSON.stringify(cardsIn(container).map(cardKey))); }catch(e){}
  }

  function injectStyle(){
    if(document.getElementById('reorderStyle')) return;
    const style = document.createElement('style');
    style.id = 'reorderStyle';
    style.textContent = `
      .reorder-bar{
        display:flex; align-items:center; justify-content:center; gap:12px;
        max-width:480px; margin:0 auto 20px; flex-wrap:wrap;
      }
      .reorder-toggle{
        padding:7px 14px; border-radius:20px; border:1px solid var(--line, rgba(255,255,255,0.14));
        background:var(--card, rgba(22,28,48,0.75)); color:var(--ink, #f4f1ea);
        font-size:12.5px; font-weight:600; font-family:"Helvetica Neue",Arial,sans-serif;
        cursor:pointer;
      }
      .reorder-toggle:hover{ opacity:.9; }
      .reorder-reset{
        font-size:11.5px; color:var(--ink-soft, #a3a9bf); background:none; border:none;
        text-decoration:underline; cursor:pointer; padding:2px 4px; display:none;
        font-family:"Helvetica Neue",Arial,sans-serif;
      }
      body.reorder-editing .reorder-reset{ display:inline-block; }
      .reorder-handle{
        display:none; margin-left:auto; align-self:center;
        padding:4px 10px; font-size:19px; line-height:1;
        color:var(--ink-soft, #a3a9bf); cursor:grab; touch-action:none; user-select:none;
      }
      body.reorder-editing .reorder-handle{ display:inline-flex; }
      body.reorder-editing a.card{ cursor:default; }
      a.card.reorder-dragging{ opacity:.55; }
    `;
    document.head.appendChild(style);
  }

  let editing = false;
  const groups = []; // { container, key }
  let dragEl = null;
  let dragGroup = null;

  function blockNavWhileEditing(e){
    if(editing) e.preventDefault();
  }

  function onHandlePointerDown(e){
    if(!editing) return;
    const card = e.currentTarget.closest('a.card');
    const group = groups.find(g => g.container.contains(card));
    if(!card || !group) return;
    e.preventDefault();
    dragEl = card;
    dragGroup = group;
    card.classList.add('reorder-dragging');
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp, { once: true });
  }

  function onPointerMove(e){
    if(!dragEl || !dragGroup) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if(!el) return;
    const overCard = el.closest('a.card');
    if(!overCard || overCard === dragEl || !dragGroup.container.contains(overCard)) return;
    const cards = cardsIn(dragGroup.container);
    const dragIdx = cards.indexOf(dragEl);
    const overIdx = cards.indexOf(overCard);
    if(dragIdx < overIdx){
      dragGroup.container.insertBefore(dragEl, overCard.nextSibling);
    } else {
      dragGroup.container.insertBefore(dragEl, overCard);
    }
  }

  function onPointerUp(){
    document.removeEventListener('pointermove', onPointerMove);
    if(dragEl) dragEl.classList.remove('reorder-dragging');
    if(dragGroup) saveOrder(dragGroup.container, dragGroup.key);
    dragEl = null;
    dragGroup = null;
  }

  function ensureHandle(card){
    let h = card.querySelector(':scope > .reorder-handle');
    if(h) return h;
    h = document.createElement('span');
    h.className = 'reorder-handle';
    h.setAttribute('role', 'button');
    h.setAttribute('aria-label', 'Drag to move this button');
    h.textContent = '⠿⠿'; // ⠿⠿ dots, reads as a grab handle
    h.addEventListener('pointerdown', onHandlePointerDown);
    h.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); });
    card.appendChild(h);
    return h;
  }

  function setEditing(on){
    editing = on;
    document.body.classList.toggle('reorder-editing', editing);
    const btn = document.getElementById('reorderToggle');
    if(btn) btn.textContent = editing ? '✓ Done arranging' : '✎ Edit layout';
    groups.forEach(g => cardsIn(g.container).forEach(ensureHandle));
    if(!editing) groups.forEach(g => saveOrder(g.container, g.key));
  }

  function resetAll(){
    groups.forEach(g => { try{ localStorage.removeItem(g.key); }catch(e){} });
    location.reload();
  }

  function injectControls(firstContainer){
    if(document.getElementById('reorderToggle')) return;
    const bar = document.createElement('div');
    bar.className = 'reorder-bar';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'reorderToggle';
    btn.className = 'reorder-toggle';
    btn.textContent = '✎ Edit layout';
    btn.setAttribute('aria-label', 'Rearrange the buttons on this page');
    btn.addEventListener('click', () => setEditing(!editing));
    bar.appendChild(btn);

    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'reorder-reset';
    reset.textContent = 'Reset to default order';
    reset.addEventListener('click', resetAll);
    bar.appendChild(reset);

    // Sits inline in the page flow (right above the first card group) rather
    // than floating fixed, so it never overlaps a back link, theme toggle,
    // or anything else a given page happens to put in a corner.
    const divider = document.querySelector('.divider');
    if(divider && divider.parentNode){
      divider.insertAdjacentElement('afterend', bar);
    } else if(firstContainer && firstContainer.parentNode){
      firstContainer.parentNode.insertBefore(bar, firstContainer);
    } else {
      document.body.insertBefore(bar, document.body.firstChild);
    }
  }

  function init(){
    const containers = Array.from(document.querySelectorAll('.cards'));
    if(!containers.length) return;
    injectStyle();
    containers.forEach((container, idx) => {
      const key = storageKeyFor(idx);
      applySavedOrder(container, key);
      groups.push({ container, key });
      cardsIn(container).forEach(c => c.addEventListener('click', blockNavWhileEditing));
    });
    injectControls(containers[0]);
  }

  // Cards exist in the DOM even on pages that sit behind a password lock
  // screen, so restoring order and wiring up the toggle can happen right
  // away — none of it is visible until the page itself is unlocked.
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
