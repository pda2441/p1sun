import { dishes } from './dishes.js';

const $ = (selector, context = document) => context.querySelector(selector);
const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const wideScreen = matchMedia('(min-width: 1024px)');
const desktopNav = matchMedia('(min-width: 601px)');
const formatPrice = (price) => `${new Intl.NumberFormat('ru-RU').format(price)} ₽`;
const ease = 'cubic-bezier(.22,.68,.12,1)';
const animate = (element, frames, options = {}) => {
  if (!element || reducedMotion.matches || typeof element.animate !== 'function') return null;
  try {
    const animation = element.animate(frames, { duration: 350, easing: ease, ...options });
    animation.finished?.catch(() => {}); // Decorative effects may also be cancelled.
    return animation;
  }
  catch { return null; /* Effects must never block content or interaction. */ }
};
const finish = async (animation) => {
  if (!animation) return;
  let timer;
  try {
    await Promise.race([animation.finished, new Promise(resolve => {
      timer = setTimeout(resolve, 1000);
    })]);
  } catch { /* A newer interaction owns the UI. */ }
  finally { clearTimeout(timer); animation.cancel(); }
};

function createCard(dish) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'dish-card';
  card.dataset.dish = dish.id;
  card.setAttribute('aria-haspopup', 'dialog');
  card.setAttribute('aria-label', `${dish.name}, ${formatPrice(dish.price)}. Подробнее`);
  const photo = document.createElement('span');
  photo.className = 'dish-photo';
  const image = document.createElement('img');
  image.src = dish.image;
  image.alt = dish.name;
  image.width = 640;
  image.height = 640;
  image.loading = 'lazy';
  image.decoding = 'async';
  photo.append(image);
  const titleRow = document.createElement('span');
  titleRow.className = 'dish-title-row';
  const title = document.createElement('h3');
  title.textContent = dish.name;
  const price = document.createElement('span');
  price.className = 'dish-price';
  price.textContent = formatPrice(dish.price);
  titleRow.append(title, price);
  const description = document.createElement('p');
  description.className = 'dish-description';
  description.textContent = dish.description.split('. ')[0].replace(/\.$/, '') + '.';
  const detail = document.createElement('span');
  detail.className = 'dish-detail';
  detail.append('Подробнее');
  const icon = document.createElement('span');
  icon.textContent = '+';
  icon.setAttribute('aria-hidden', 'true');
  detail.append(icon);
  card.append(photo, titleRow, description, detail);
  return card;
}

const favoritesGrid = $('#favorites-grid');
if (favoritesGrid) {
  favoritesGrid.replaceChildren(...['khinkali', 'adjaruli', 'pkhali', 'satsivi']
    .map((id) => createCard(dishes.find((dish) => dish.id === id))));
}

const menuGrid = $('#menu-grid');
let filterRevision = 0;
let filterAnimations = [];
async function filterMenu(category = 'all', withMotion = true) {
  if (!menuGrid) return;
  const revision = ++filterRevision;
  const oldHeight = menuGrid.getBoundingClientRect().height;
  filterAnimations.forEach((animation) => animation?.cancel());
  filterAnimations = [];
  const filtered = dishes.filter((dish) => category === 'all' || dish.category === category);
  $$('[data-category]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.category === category));
  });
  menuGrid.style.height = '';
  menuGrid.style.overflow = '';
  menuGrid.replaceChildren(...filtered.map(createCard));
  const count = $('#menu-count');
  if (count) {
    const number = filtered.length;
    const noun = number % 100 >= 11 && number % 100 <= 14 ? 'блюд'
      : number % 10 === 1 ? 'блюдо' : number % 10 >= 2 && number % 10 <= 4 ? 'блюда' : 'блюд';
    count.textContent = `${number} ${noun}`;
  }
  if (!withMotion || reducedMotion.matches || menuGrid.closest('[hidden]')) return;
  const newHeight = menuGrid.getBoundingClientRect().height;
  menuGrid.style.height = `${newHeight}px`;
  menuGrid.style.overflow = 'clip';
  const heightAnimation = animate(menuGrid, [{ height: `${oldHeight}px` }, { height: `${newHeight}px` }], { duration: 400 });
  filterAnimations.push(heightAnimation);
  [...menuGrid.children].forEach((card, index) => {
    filterAnimations.push(animate(card,
      [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 300, delay: Math.min(index * 22, 150), fill: 'backwards' }));
  });
  await Promise.all(filterAnimations.map(finish));
  if (revision === filterRevision) {
    menuGrid.style.height = '';
    menuGrid.style.overflow = '';
    filterAnimations = [];
  }
}
filterMenu('all', false);
$$('[data-category]').forEach((button) => button.addEventListener('click', () => {
  if (button.getAttribute('aria-pressed') !== 'true') filterMenu(button.dataset.category);
}));

// Hash routes are native links, so copied addresses and browser history work.
const pageNames = ['home', 'menu', 'atmosphere', 'booking'];
const pages = $$('section[data-page]');
const positions = new Map();
let currentPage = null;
let routeRevision = 0;
let routeAnimations = [];
const pageTitles = { home: 'Грузинский ресторан', menu: 'Меню', atmosphere: 'Атмосфера', booking: 'Бронирование' };
const navToggle = $('#nav-toggle');
const mainNav = $('#main-nav');
function closeNav(returnFocus = false) {
  document.body.classList.remove('nav-open');
  navToggle?.setAttribute('aria-expanded', 'false');
  if (returnFocus) navToggle?.focus();
}
navToggle?.addEventListener('click', () => {
  const opening = navToggle.getAttribute('aria-expanded') !== 'true';
  document.body.classList.toggle('nav-open', opening);
  navToggle.setAttribute('aria-expanded', String(opening));
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && document.body.classList.contains('nav-open')) closeNav(true);
});
desktopNav.addEventListener('change', () => { if (desktopNav.matches) closeNav(); });
document.addEventListener('click', (event) => {
  if (document.body.classList.contains('nav-open') && !mainNav?.contains(event.target) && !navToggle?.contains(event.target)) closeNav();
});
let pendingNav = false;
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="#"]');
  if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  const name = link.getAttribute('href').slice(1);
  if (!pageNames.includes(name)) {
    const target = document.getElementById(name);
    if (target) {
      event.preventDefault();
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
    return;
  }
  closeNav();
  pendingNav = true;
  if (location.hash === `#${name}` || (!location.hash && name === 'home')) {
    event.preventDefault();
    pendingNav = false;
    const heading = $(`[data-page="${name}"] .page-heading`);
    heading?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  }
});

async function route(initial = false) {
  let name = location.hash.slice(1) || 'home';
  if (!pageNames.includes(name)) {
    name = 'home';
    history.replaceState(null, '', '#home');
  }
  const next = pages.find((page) => (page.dataset.page || page.id) === name);
  if (!next) return;
  const revision = ++routeRevision;
  const fromClick = pendingNav;
  pendingNav = false;
  if (currentPage) positions.set(currentPage, window.scrollY);
  routeAnimations.forEach((animation) => animation?.cancel());
  routeAnimations = [];
  if (!initial && dialog?.open) closeDialog(false, true);
  closeNav();
  $$('a[href^="#"]').forEach((link) => {
    const isActive = link.getAttribute('href') === `#${name}`;
    if (isActive) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  // Commit the route synchronously. Animation only decorates already visible content.
  pages.forEach((page) => { page.hidden = page !== next; });
  currentPage = name;
  document.title = `Золотая Лоза — ${pageTitles[name]}`;
  // User-directed navigation starts at the heading; Back/Forward restores position.
  const scrollTop = initial || fromClick ? 0 : (positions.get(name) || 0);
  window.scrollTo({ top: scrollTop, behavior: 'instant' });
  if (!initial) $('.page-heading', next)?.focus({ preventScroll: true });
  if (!initial) {
    const incoming = animate(next,
      [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 330 });
    routeAnimations.push(incoming);
    await finish(incoming);
  }
  if (revision === routeRevision) updateScroll();
}
window.addEventListener('hashchange', () => route());
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

const dialog = $('#detail-dialog');
const dialogBody = $('#dialog-body');
let dialogRevision = 0;
let dialogAnimations = [];
let dialogTrigger = null;
let sharedClone = null;
function cancelDialogAnimations() {
  dialogAnimations.forEach((animation) => animation?.cancel());
  dialogAnimations = [];
  sharedClone?.remove();
  sharedClone = null;
}

function paragraph(className, text) {
  const element = document.createElement('p');
  element.className = className;
  element.textContent = text;
  return element;
}
function dishDialog(dish) {
  const layout = document.createElement('div');
  layout.className = 'dish-dialog-layout';
  const image = document.createElement('img');
  image.src = dish.image;
  image.alt = dish.name;
  image.className = 'dialog-photo';
  image.width = 800;
  image.height = 900;
  const copy = document.createElement('div');
  copy.className = 'dialog-copy';
  const heading = document.createElement('h2');
  heading.id = 'dialog-title';
  heading.textContent = dish.name;
  const ingredientsHeading = document.createElement('h3');
  ingredientsHeading.textContent = 'Что внутри';
  const ingredients = document.createElement('ul');
  ingredients.className = 'dialog-ingredients';
  dish.ingredients.forEach((ingredient) => {
    const item = document.createElement('li');
    item.textContent = ingredient;
    ingredients.append(item);
  });
  const allergensHeading = document.createElement('h3');
  allergensHeading.textContent = 'Аллергены в деморецепте';
  const meta = document.createElement('div');
  meta.className = 'dialog-meta';
  const weight = document.createElement('span');
  weight.textContent = dish.weight;
  const price = document.createElement('strong');
  price.textContent = formatPrice(dish.price);
  meta.append(weight, price);
  copy.append(heading, paragraph('dialog-description', dish.description),
    meta, ingredientsHeading, ingredients,
    allergensHeading, paragraph('dialog-allergens', dish.allergens.join(', ') + '.'),
    paragraph('dialog-note', 'Демонстрационные состав, порция и цена. Точный рецепт и возможные следы аллергенов реального ресторана неизвестны.'));
  layout.append(image, copy);
  return layout;
}
function galleryDialog(trigger) {
  const layout = document.createElement('figure');
  layout.className = 'gallery-dialog-layout';
  const image = document.createElement('img');
  image.src = trigger.dataset.gallery;
  image.alt = trigger.dataset.caption || $('img', trigger)?.alt || 'Атмосфера Золотая Лоза';
  image.width = 1400;
  image.height = 1000;
  image.className = 'dialog-photo';
  const caption = document.createElement('figcaption');
  caption.className = 'gallery-dialog-caption';
  caption.id = 'dialog-title';
  caption.textContent = trigger.dataset.caption || 'Атмосфера Золотая Лоза';
  layout.append(image, caption);
  return layout;
}
function shareImage(source) {
  const target = $('.dialog-photo', dialogBody);
  if (!source || !target || reducedMotion.matches || !source.complete) return;
  const start = source.getBoundingClientRect();
  const end = target.getBoundingClientRect();
  if (!start.width || !start.height || !end.width || !end.height || start.bottom < 0 || start.top > innerHeight) return;
  const clone = source.cloneNode();
  clone.removeAttribute('loading');
  clone.alt = '';
  clone.setAttribute('aria-hidden', 'true');
  Object.assign(clone.style, {
    position: 'fixed', left: `${end.left}px`, top: `${end.top}px`, width: `${end.width}px`,
    height: `${end.height}px`, objectFit: 'cover', zIndex: '10', pointerEvents: 'none',
    transformOrigin: 'top left', borderRadius: '4px',
  });
  // A clone inside the top-layer dialog can rise above the backdrop.
  dialog.append(clone);
  sharedClone = clone;
  const animation = animate(clone, [
    { transform: `translate(${start.left - end.left}px, ${start.top - end.top}px) scale(${start.width / end.width}, ${start.height / end.height})`, opacity: 1 },
    { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0.85 },
    { transform: 'translate(0, 0) scale(1)', opacity: 0 },
  ], { duration: 420 });
  dialogAnimations.push(animation);
  finish(animation).then(() => {
    clone.remove();
    if (sharedClone === clone) sharedClone = null;
  });
}
async function openDialog(trigger) {
  if (!dialog || !dialogBody) return;
  const dish = dishes.find((item) => item.id === trigger.dataset.dish);
  if (!dish && !trigger.dataset.gallery) return;
  ++dialogRevision;
  cancelDialogAnimations();
  dialogTrigger = trigger;
  dialogBody.replaceChildren(dish ? dishDialog(dish) : galleryDialog(trigger));
  dialog.classList.toggle('is-gallery', !dish);
  document.body.classList.add('modal-open');
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  $('[data-close-dialog]', dialog)?.focus({ preventScroll: true });
  dialogAnimations.push(animate(dialogBody,
    [{ opacity: 0, transform: 'translateY(18px) scale(.985)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }],
    { duration: 350 }));
  const photo = $('img', trigger);
  // Wait one frame so the native dialog has its final dimensions.
  const revision = dialogRevision;
  requestAnimationFrame(() => { if (revision === dialogRevision && dialog.open) shareImage(photo); });
}
async function closeDialog(restoreFocus = true, immediate = false) {
  if (!dialog?.open) return;
  const revision = ++dialogRevision;
  cancelDialogAnimations();
  const outgoing = immediate ? null : animate(dialogBody,
    [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(10px)' }], { duration: 180 });
  dialogAnimations.push(outgoing);
  if (outgoing) await finish(outgoing);
  if (revision !== dialogRevision) return;
  dialog.close();
  cancelDialogAnimations();
  document.body.classList.remove('modal-open');
  const trigger = dialogTrigger;
  dialogTrigger = null;
  if (restoreFocus && trigger?.isConnected && !trigger.closest('[hidden]')) trigger.focus({ preventScroll: true });
}
document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-dish], [data-gallery]');
  if (trigger) openDialog(trigger);
});
$$('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => closeDialog()));
dialog?.addEventListener('cancel', (event) => { event.preventDefault(); closeDialog(); });
dialog?.addEventListener('click', (event) => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeDialog();
});
dialog?.addEventListener('close', () => {
  document.body.classList.remove('modal-open');
});

const form = $('#booking-form');
const feedback = $('#booking-feedback');
const allowedTimes = Array.from({ length: 19 }, (_, index) => `${String(12 + Math.floor(index / 2)).padStart(2, '0')}:${index % 2 ? '30' : '00'}`);
const isoLocal = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
function dateRange() {
  const today = new Date();
  const maximum = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 90);
  return { min: isoLocal(today), max: isoLocal(maximum) };
}
function syncDateRange() {
  const date = $('#booking-date');
  if (date) Object.assign(date, dateRange());
}
syncDateRange();
const timeSelect = $('#booking-time');
if (timeSelect && timeSelect.options.length < 2) {
  if (!timeSelect.options.length) timeSelect.add(new Option('Выберите время', ''));
  allowedTimes.forEach((time) => timeSelect.add(new Option(time, time)));
}
const fieldNames = ['name', 'phone', 'date', 'time', 'guests', 'comment'];
let attemptedBooking = false;
function validateField(name) {
  const field = $(`#booking-${name}`);
  if (!field) return '';
  const value = field.value.trim();
  if (name === 'name') return value.length >= 2 && value.length <= 60 ? '' : 'Укажите имя: от 2 до 60 символов.';
  if (name === 'phone') {
    const digits = value.replace(/\D/g, '');
    return /^[+\d\s()−—-]+$/.test(value) && digits.length >= 10 && digits.length <= 15 ? '' : 'Укажите телефон: от 10 до 15 цифр.';
  }
  if (name === 'date') {
    const { min, max } = dateRange();
    const parsed = new Date(`${value}T12:00:00`);
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parsed.getTime()) && isoLocal(parsed) === value && value >= min && value <= max
      ? '' : 'Выберите дату от сегодняшнего дня до 90 дней вперёд.';
  }
  if (name === 'time') return allowedTimes.includes(value) ? '' : 'Выберите время с 12:00 до 21:00.';
  if (name === 'guests') return /^[1-8]$/.test(value) ? '' : 'Выберите количество гостей: от 1 до 8.';
  if (name === 'comment') return value.length <= 500 ? '' : 'Сократите комментарий до 500 символов.';
  return '';
}
function showFieldError(name) {
  const field = $(`#booking-${name}`);
  const error = $(`#error-${name}`);
  if (!field) return false;
  const message = validateField(name);
  if (message) field.setAttribute('aria-invalid', 'true');
  else field.removeAttribute('aria-invalid');
  if (error) error.textContent = message;
  return Boolean(message);
}
function clearFeedback() {
  if (!feedback) return;
  feedback.textContent = '';
  feedback.hidden = true;
}
form?.addEventListener('submit', (event) => {
  event.preventDefault();
  syncDateRange();
  attemptedBooking = true;
  clearFeedback();
  const invalid = fieldNames.filter(showFieldError);
  if (invalid.length) {
    $(`#booking-${invalid[0]}`)?.focus();
    return;
  }
  if (feedback) {
    feedback.textContent = 'Демонстрационная заявка. В ресторан не отправлена';
    feedback.hidden = false;
    feedback.focus({ preventScroll: true });
    feedback.scrollIntoView({ block: 'nearest', behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  }
});
fieldNames.forEach((name) => {
  const field = $(`#booking-${name}`);
  field?.addEventListener('input', () => { clearFeedback(); if (attemptedBooking) showFieldError(name); });
  field?.addEventListener('change', () => { clearFeedback(); if (attemptedBooking) showFieldError(name); });
  field?.addEventListener('blur', () => { if (attemptedBooking) showFieldError(name); });
});
$('#booking-date')?.addEventListener('focus', syncDateRange);

let scrollQueued = false;
function updateScroll() {
  const scroll = window.scrollY;
  $('header')?.classList.toggle('scrolled', scroll > 24);
  const scrollable = document.documentElement.scrollHeight - innerHeight;
  const progress = $('#scroll-progress');
  if (progress) progress.style.transform = `scaleX(${scrollable > 0 ? Math.min(1, scroll / scrollable) : 0})`;
  $$('img[data-parallax]').forEach((image) => {
    if (reducedMotion.matches || !wideScreen.matches || image.closest('[hidden]')) {
      image.style.transform = '';
      return;
    }
    const rect = image.getBoundingClientRect();
    if (rect.bottom < -50 || rect.top > innerHeight + 50) return;
    const position = (rect.top + rect.height / 2 - innerHeight / 2) / innerHeight;
    image.style.transform = `translateY(${Math.max(-12, Math.min(12, -position * 18))}px) scale(1.035)`;
  });
  scrollQueued = false;
}
window.addEventListener('scroll', () => {
  if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(updateScroll); }
}, { passive: true });
window.addEventListener('resize', updateScroll, { passive: true });
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) document.getAnimations().forEach((animation) => {
    try { animation.finish(); } catch { animation.cancel(); }
  });
  updateScroll();
});

const revealed = new WeakSet();
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting || revealed.has(entry.target)) return;
      revealed.add(entry.target);
      animate(entry.target, [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 500 });
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.08 });
  $$('.reveal').forEach((element) => observer.observe(element));
}

await route(true);
if (currentPage === 'home') {
  $$('.hero-copy > *').forEach((element, index) => animate(element,
    [{ opacity: 0, transform: 'translateY(20px)' }, { opacity: 1, transform: 'translateY(0)' }],
    { duration: 570, delay: Math.min(index * 90, 270), fill: 'backwards' }));
  animate($('.hero-image'), [{ transform: 'scale(1.06)', opacity: 0.65 }, { transform: 'scale(1)', opacity: 1 }], { duration: 850 });
}
updateScroll();
