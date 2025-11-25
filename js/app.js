/* App script: header/footer include, router, popup, EmailJS send (REST)
   Replace EMAILJS keys in EMAILJS_CONFIG before using */

const EMAILJS_CONFIG = {
  service_id: 'service_vg1n0xc',
  template_id: 'template_0gxdcga',
  user_id: '2N2lJSVLitMSVcPoU'
};

const POPUP_LAST_KEY = 'honda_demo_popup_last';
const POPUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
let popupTimerId = null;
const ADMIN_REDIRECT_KEY = 'honda_admin_redirect';
const ADMIN_DEFAULT_USER = 'admin';
const ADMIN_DEFAULT_PASS = 'admin';
const SESSION_LOGIN_FLAG = 'session_loggin';
const VEHICLE_CACHE_KEY = 'honda_vehicle_cache_v1';
const VEHICLE_CACHE_TTL = 5 * 60 * 1000;
const VEHICLE_CHOICES = [
  'Honda City G',
  'Honda City L',
  'Honda City RS',
  'Honda Civic G',
  'Honda Civic RS',
  'Honda Civic RS eHEV',
  'Honda CR-V G',
  'Honda CR-V L',
  'Honda CR-V L AWD',
  'Honda CR-V RS eHEV',
  'Honda BR-V G',
  'Honda BR-V L',
  'Honda HR-V G',
  'Honda HR-V L',
  'Honda HR-V RS eHEV',
  'Honda Accord'
];
let currentRouteParams = new URLSearchParams();

async function includeHTML(selector, url){
  const el = document.querySelector(selector);
  if(!el) return;
  try{
    const res = await fetch(url);
    el.innerHTML = await res.text();
    if(selector === '#site-header'){
      initNavToggle();
    }
  }catch(e){ console.error('Include failed', url, e); }
}

// Simple hash router that fetches pages from /pages/<name>.html
async function loadRoute(){
  let hash = location.hash || '#/';
  let route = hash.replace(/^#\//,'');
  const [routeName, paramString=''] = route.split('?');
  route = routeName || 'home';
  currentRouteParams = new URLSearchParams(paramString);
  if(route==='') route='home';
  setActiveNav(route);
  applyRouteLayout(route);
  // map to file
  const path = `pages/${route}.html`;
  const app = document.getElementById('app');
  // exit animation
  app.classList.add('fade-exit');
  setTimeout(async ()=>{
    try{
      const res = await fetch(path);
      if(!res.ok) throw new Error('Not found');
      const html = await res.text();
      app.innerHTML = html;
    }catch(e){
      app.innerHTML = `<section class="container"><h1>Không tìm thấy trang</h1><p>Đường dẫn: ${route}</p></section>`;
    }
    app.classList.remove('fade-exit');
    app.classList.add('fade-enter');
    requestAnimationFrame(()=>{
      app.classList.add('fade-enter-active');
      setTimeout(()=>{
        app.classList.remove('fade-enter','fade-enter-active');
        attachCardHandlers();
        if(route === 'vehicles'){
          hydrateVehicleGrid();
        }
        if(route === 'admin'){
          if(requireAdminSession()){
            initAdminModule();
          }
        }
        if(route === 'login'){
          initLoginForm();
        }
        if(route === 'detail'){
          initDetailPage();
        }
        attachCTAHandlers();
      },400);
    });
  },160);
}

function setActiveNav(route){
  const links = document.querySelectorAll('.main-nav a');
  links.forEach(link=>{
    const target = (link.getAttribute('href')||'').replace(/^#\//,'') || 'home';
    if(target === route){
      link.classList.add('is-active');
    } else {
      link.classList.remove('is-active');
    }
  });
}

window.addEventListener('hashchange', loadRoute);
window.addEventListener('popstate', loadRoute);

// Attach to card buttons in vehicle pages
function attachCardHandlers(){
  const cards = document.querySelectorAll('.card');
  cards.forEach(card=>{
    const btn = card.querySelector('.card-action');
    const slug = card.dataset.slug;
    const goDetail = ()=>{
      if(slug){
        location.hash = `#/detail?slug=${encodeURIComponent(slug)}`;
      }else{
        openDetail(card);
      }
    };
    if(btn) btn.onclick = (e)=>{ e.stopPropagation(); goDetail(); };
    card.onclick = goDetail;
  });
}

function openDetail(card){
  const title = escapeHTML(card.dataset.title || '');
  const desc = escapeHTML(card.dataset.desc || '');
  const img = sanitizeUrl(card.dataset.image) || 'https://picsum.photos/seed/honda-modal/640/360';
  const modal = document.getElementById('detail-modal');
  const body = document.getElementById('detail-body');
  body.innerHTML = `
    <h2>${title}</h2>
    <img src="${img}" alt="${title}" style="max-width:100%;border-radius:6px;margin-bottom:.6rem">
    <p>${desc}</p>
    <p><button id="request-more">Yêu cầu báo giá</button></p>
  `;
  document.getElementById('detail-close').onclick = ()=>modal.classList.add('hidden');
  modal.classList.remove('hidden');
  document.getElementById('request-more').onclick = ()=>{
    modal.classList.add('hidden');
    showLeadPopup();
  }
}

// Popup logic: show on every load/refresh
function showLeadPopup(force=false){
  const popup = document.getElementById('lead-popup');
  if(!popup) return;
  popup.classList.remove('hidden');
  // close simply hides; do not persist so it will show again on schedule
  const closeBtn = document.getElementById('lead-close');
  if(closeBtn) closeBtn.onclick = ()=>{ popup.classList.add('hidden'); };
}

function markPopupShown(){
  localStorage.setItem(POPUP_LAST_KEY, Date.now().toString());
}

function schedulePopup(){
  if(popupTimerId) clearTimeout(popupTimerId);
  const last = Number(localStorage.getItem(POPUP_LAST_KEY) || '0');
  const elapsed = Date.now() - last;
  const wait = last ? Math.max(POPUP_INTERVAL_MS - elapsed, 0) : 0;
  popupTimerId = setTimeout(()=>{
    showLeadPopup(true);
    markPopupShown();
    schedulePopup();
  }, wait);
}

// Form submit -> send via EmailJS REST API
async function sendEmail(formData){
  const url = 'https://api.emailjs.com/api/v1.0/email/send';
  const payload = {
    service_id: EMAILJS_CONFIG.service_id,
    template_id: EMAILJS_CONFIG.template_id,
    user_id: EMAILJS_CONFIG.user_id,
    template_params: formData
  };
  try{
    const res = await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if(!res.ok) throw new Error(await res.text());
    return {ok:true};
  }catch(err){
    console.error('Email send error',err);
    return {ok:false,error:err};
  }
}

function attachLeadForm(){
  const form = document.getElementById('lead-form');
  if(!form) return;
  const vehicleSelect = form.querySelector('select[name="vehicle"]');
  if(vehicleSelect && !vehicleSelect.dataset.bound){
    const options = ['<option value="">-- Chọn --</option>'];
    VEHICLE_CHOICES.forEach(name=>{
      options.push(`<option value="${escapeHTML(name)}">${escapeHTML(name)}</option>`);
    });
    vehicleSelect.innerHTML = options.join('');
    vehicleSelect.dataset.bound = 'true';
  }
  form.onsubmit = async (e)=>{
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    // add more params if needed
    const result = await sendEmail(data);
    if(result.ok){
      alert('Cảm ơn! Chúng tôi sẽ liên hệ bạn.');
      document.getElementById('lead-popup').classList.add('hidden');
      form.reset();
    }else{
      alert('Gửi thất bại. Vui lòng thử lại sau.');
    }
  };
}

// Close modals when clicking the overlay or pressing Escape
function attachModalOutsideClick(){
  document.querySelectorAll('.modal').forEach(modal=>{
    // clicks on the overlay (modal element itself) close it
    modal.addEventListener('click', (e)=>{
      if(e.target === modal){
        modal.classList.add('hidden');
      }
    });
    // prevent clicks inside modal content from bubbling to overlay
    const content = modal.querySelector('.modal-content');
    if(content){
      content.addEventListener('click', (e)=>e.stopPropagation());
    }
  });

  // close all modals on ESC
  window.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape' || e.key === 'Esc'){
      document.querySelectorAll('.modal:not(.hidden)').forEach(m=>m.classList.add('hidden'));
    }
  });
}

// Boot
(async function(){
  await includeHTML('#site-header','header.html');
  await includeHTML('#site-footer','footer.html');
  // handle nav clicks to preserve SPA behavior
  document.body.addEventListener('click', (e)=>{
    const a = e.target.closest('a');
    if(!a) return;
    const href = a.getAttribute('href')||'';
    if(href.startsWith('#/')){
      // let hashchange handle route
      // close mobile nav etc if needed
      closeNavMenu();
    }
  });

  // initial route
  loadRoute();

  // prepare popup & form
  attachLeadForm();
  attachModalOutsideClick();
  // initial popup display logic: show immediately if never shown or last shown ≥ 10 minutes ago
  const lastShown = Number(localStorage.getItem(POPUP_LAST_KEY) || '0');
  if(!lastShown || Date.now() - lastShown >= POPUP_INTERVAL_MS){
    showLeadPopup(true);
    markPopupShown();
  }
  // schedule recurring popup every 10 minutes
  schedulePopup();
})();

function initNavToggle(){
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.main-nav');
  if(!toggle || !nav) return;
  toggle.addEventListener('click', (e)=>{
    e.stopPropagation();
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', (!expanded).toString());
    nav.classList.toggle('is-open', !expanded);
  });

  document.addEventListener('click', (e)=>{
    if(!nav.contains(e.target) && !toggle.contains(e.target)){
      closeNavMenu();
    }
  });
}

function closeNavMenu(){
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.main-nav');
  if(toggle){ toggle.setAttribute('aria-expanded','false'); }
  if(nav){ nav.classList.remove('is-open'); }
}

function applyRouteLayout(route){
  const isLogin = route === 'login';
  document.body.classList.toggle('login-only', isLogin);
}

function attachCTAHandlers(){
  ['hero-popup','cta-popup'].forEach(id=>{
    const btn = document.getElementById(id);
    if(btn && !btn.dataset.bound){
      btn.dataset.bound = 'true';
      btn.addEventListener('click', ()=> showLeadPopup(true));
    }
  });
}

function getRouteParam(key){
  return currentRouteParams.get(key);
}

async function hydrateVehicleGrid(){
  const grid = document.getElementById('vehicles-grid');
  if(!grid) return;

  const cached = getCachedVehicles();
  if(cached.length){
    grid.innerHTML = cached.map(renderVehicleCard).join('');
    attachCardHandlers();
    return;
  }

  grid.innerHTML = renderSkeletonCards();

  try{
    const fresh = await fetchAndCacheVehicles();
    if(!fresh.length){
      grid.innerHTML = `<div class="vehicles-status">Chưa có dữ liệu xe trong Google Sheet.</div>`;
      return;
    }
    grid.innerHTML = fresh.map(renderVehicleCard).join('');
    attachCardHandlers();
  }catch(error){
    console.error('Vehicle API error', error);
    grid.innerHTML = `<div class="vehicles-status error">Không thể tải dữ liệu: ${escapeHTML(error.message)}</div>`;
  }
}

function normalizeVehicleList(result){
  if(!result) return [];
  if(Array.isArray(result)) return result;
  if(Array.isArray(result.data)) return result.data;
  if(Array.isArray(result.records)) return result.records;
  if(Array.isArray(result.vehicles)) return result.vehicles;
  return [];
}

function renderVehicleCard(vehicle){
  const name = escapeHTML(vehicle.name || 'Chưa đặt tên');
  const desc = escapeHTML(vehicle.description || 'Đang cập nhật mô tả.');
  const img = sanitizeUrl(vehicle.imageUrl) || 'https://picsum.photos/seed/honda-motion/640/400';
  const price = formatCurrency(vehicle.price);
  const slug = escapeHTML(vehicle.slug || '');
  return `
    <div class="card" data-title="${name}" data-desc="${desc}" data-image="${img}" data-slug="${slug}">
      <div class="thumb" style="background-image:url('${img}')"></div>
      <div class="card-overlay">
        <h3>${name}</h3>
        <p>${desc}</p>
        ${price ? `<p><strong>${escapeHTML(price)}</strong></p>` : ''}
      </div>
      <button class="card-action">Xem chi tiết</button>
    </div>
  `;
}

function renderSkeletonCards(count = 4){
  return Array.from({length: count}).map(()=>`
    <div class="card skeleton-card">
      <div class="thumb"></div>
      <div class="card-overlay"><h3>Đang tải dữ liệu...</h3><p>Vui lòng chờ trong giây lát.</p></div>
    </div>
  `).join('');
}

function saveVehicleCache(list){
  try{
    const normalized = prepareVehicleList(Array.isArray(list) ? list : []);
    const payload = { ts: Date.now(), list: normalized };
    localStorage.setItem(VEHICLE_CACHE_KEY, JSON.stringify(payload));
  }catch(err){
    console.warn('Không thể lưu cache xe', err);
  }
}

function getVehicleCache(){
  try{
    const raw = localStorage.getItem(VEHICLE_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch{
    return null;
  }
}

function getCachedVehicles(){
  const cache = getVehicleCache();
  if(cache && Array.isArray(cache.list) && cache.list.length){
    return prepareVehicleList(cache.list);
  }
  return [];
}

async function fetchAndCacheVehicles(){
  if(!window.AdminApi) throw new Error('Chưa nạp Admin API.');
  const response = await window.AdminApi.listVehicles();
  const vehicles = prepareVehicleList(normalizeVehicleList(response));
  saveVehicleCache(vehicles);
  return vehicles;
}

async function ensureVehicleData(){
  const cached = getCachedVehicles();
  if(cached.length) return cached;
  return fetchAndCacheVehicles();
}

function prepareVehicleList(list){
  if(!Array.isArray(list)) return [];
  return list.map((item = {}, index)=>{
    const name = (item.name || `Mẫu xe ${index + 1}`).toString().trim();
    const slug = (item.slug || slugify(name)).toString();
    return {
      ...item,
      name,
      slug,
      description: item.description || 'Đang cập nhật mô tả.',
      imageUrl: item.imageUrl || item.image || '',
    };
  });
}

function slugify(value=''){
  return value.toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'')
    || 'vehicle';
}

function escapeHTML(value=''){
  return String(value)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function sanitizeUrl(url){
  if(!url) return '';
  try{
    const trimmed = url.trim();
    if(!trimmed) return '';
    return encodeURI(trimmed);
  }catch{
    return '';
  }
}

function formatCurrency(value){
  if(value === null || value === undefined || value === '') return '';
  const num = Number(value);
  if(Number.isNaN(num)) return '';
  return num.toLocaleString('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
}

function isAdminLoggedIn(){
  return sessionStorage.getItem(SESSION_LOGIN_FLAG) === 'true';
}

function setAdminLoggedIn(state){
  if(state){
    sessionStorage.setItem(SESSION_LOGIN_FLAG, 'true');
  }else{
    sessionStorage.removeItem(SESSION_LOGIN_FLAG);
  }
}

function requireAdminSession(){
  if(isAdminLoggedIn()) return true;
  sessionStorage.setItem(ADMIN_REDIRECT_KEY, '#/admin');
  if(location.hash !== '#/login'){
    location.hash = '#/login';
  }else{
    loadRoute();
  }
  return false;
}

function initLoginForm(){
  const form = document.getElementById('login-form');
  const statusEl = document.getElementById('login-status');
  if(!form || !statusEl) return;
  if(form.dataset.ready === 'true') return;
  form.dataset.ready = 'true';

  setLoginStatus('Vui lòng nhập admin/admin để đăng nhập.', 'info');

  function setLoginStatus(message, type='info'){
    statusEl.textContent = message;
    statusEl.classList.remove('error','success');
    if(type !== 'info'){
      statusEl.classList.add(type);
    }
  }

  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const username = form.elements['username'].value.trim();
    const password = form.elements['password'].value.trim();
    if(username === ADMIN_DEFAULT_USER && password === ADMIN_DEFAULT_PASS){
      setAdminLoggedIn(true);
      setLoginStatus('Đăng nhập thành công, đang chuyển hướng...', 'success');
      const target = sessionStorage.getItem(ADMIN_REDIRECT_KEY) || '#/admin';
      sessionStorage.removeItem(ADMIN_REDIRECT_KEY);
      setTimeout(()=>{ location.hash = target; }, 600);
    }else{
      setLoginStatus('Sai tên đăng nhập hoặc mật khẩu.', 'error');
    }
  });
}

function logoutAdmin(){
  setAdminLoggedIn(false);
  sessionStorage.removeItem(ADMIN_REDIRECT_KEY);
}

function initAdminModule(){
  const tableBody = document.getElementById('admin-rows');
  const statusEl = document.getElementById('admin-status');
  const form = document.getElementById('admin-form');
  if(!tableBody || !statusEl || !form) return;
  if(tableBody.dataset.ready === 'true') return;
  const deleteBtn = document.getElementById('admin-delete');
  const resetBtn = document.getElementById('admin-reset');
  const refreshBtn = document.getElementById('admin-refresh');
  const syncBtn = document.getElementById('admin-sync');
  const logoutBtn = document.getElementById('admin-logout');
  const rowIdInput = document.getElementById('admin-row-id');

  if(!window.AdminApi){
    setAdminStatus('Chưa nạp Admin API.', 'error');
    return;
  }

  tableBody.dataset.ready = 'true';

  let currentRows = [];

  function setAdminStatus(message, type='info'){
    statusEl.textContent = message;
    statusEl.classList.remove('error','success');
    if(type !== 'info'){
      statusEl.classList.add(type);
    }
  }

  function renderRows(rows){
    if(!rows.length){
      tableBody.innerHTML = '<tr><td colspan="6">Chưa có dữ liệu.</td></tr>';
      return;
    }
    tableBody.innerHTML = rows.map((row, index)=>{
      const rowId = row.rowId || row.id || row._rowNumber || (index + 1);
      const imageLink = row.imageUrl ? `<img src="${sanitizeUrl(row.imageUrl)}" alt="Ảnh" width="100">` : '-';
      return `
        <tr data-row-id="${rowId}">
          <td>${escapeHTML(String(rowId))}</td>
          <td>${escapeHTML(row.name || '')}</td>
          <td>${escapeHTML(row.description || '')}</td>
          <td>${escapeHTML(formatCurrency(row.price) || '')}</td>
          <td>${imageLink}</td>
        </tr>
      `;
    }).join('');

    tableBody.querySelectorAll('button[data-edit]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const rowId = btn.getAttribute('data-edit');
        const row = currentRows.find(r=>String(r.rowId||r.id||r._rowNumber||'') === rowId);
        if(row) fillForm(row, rowId);
      });
    });
  }

  function fillForm(row, rowId){
    rowIdInput.value = rowId;
    form.elements['name'].value = row.name || '';
    form.elements['description'].value = row.description || '';
    form.elements['price'].value = row.price || '';
    form.elements['slug'].value = row.slug || '';
    form.elements['imageUrl'].value = row.imageUrl || '';
    deleteBtn.disabled = false;
  }

  function resetForm(){
    form.reset();
    rowIdInput.value = '';
    deleteBtn.disabled = true;
  }

  async function loadRows(){
    setAdminStatus('Đang lấy dữ liệu từ Google Sheet...');
    try{
      const response = await window.AdminApi.listVehicles();
      currentRows = normalizeVehicleList(response);
      renderRows(currentRows);
      setAdminStatus(`Đã tải ${currentRows.length} dòng.`, 'success');
    }catch(error){
      console.error('Admin load error', error);
      setAdminStatus(error.message, 'error');
    }
  }

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    const rowId = payload.rowId;
    delete payload.rowId;
    Object.keys(payload).forEach(key=>{
      if(typeof payload[key] === 'string'){
        payload[key] = payload[key].trim();
      }
    });
    if(payload.price){
      const normalized = Number(payload.price.replace(/[^0-9.-]/g,''));
      payload.price = Number.isFinite(normalized) ? normalized : payload.price;
    }
    try{
      if(rowId){
        await window.AdminApi.updateVehicle(rowId, payload);
        setAdminStatus('Đã cập nhật dòng.', 'success');
      }else{
        await window.AdminApi.createVehicle(payload);
        setAdminStatus('Đã thêm dòng mới.', 'success');
      }
      await loadRows();
      resetForm();
    }catch(error){
      console.error('Admin save error', error);
      setAdminStatus(error.message, 'error');
    }
  });

  deleteBtn?.addEventListener('click', async ()=>{
    const rowId = rowIdInput.value;
    if(!rowId) return;
    if(!confirm('Bạn có chắc muốn xoá dòng này?')) return;
    try{
      await window.AdminApi.deleteVehicle(rowId);
      setAdminStatus('Đã xoá dòng.', 'success');
      await loadRows();
      resetForm();
    }catch(error){
      console.error('Admin delete error', error);
      setAdminStatus(error.message, 'error');
    }
  });

  resetBtn?.addEventListener('click', (e)=>{
    e.preventDefault();
    resetForm();
  });

  refreshBtn?.addEventListener('click', (e)=>{
    e.preventDefault();
    loadRows();
  });

  syncBtn?.addEventListener('click', ()=>{
    if(!currentRows.length){
      setAdminStatus('Không có dữ liệu để đồng bộ.', 'error');
      return;
    }
    saveVehicleCache(prepareVehicleList(currentRows));
    setAdminStatus('Đã lưu cache cục bộ. Trang Dòng xe sẽ dùng dữ liệu mới.', 'success');
  });

  logoutBtn?.addEventListener('click', ()=>{
    logoutAdmin();
    setAdminStatus('Đã đăng xuất.', 'success');
    setTimeout(()=>{ location.hash = '#/login'; }, 300);
  });

  loadRows();
}

async function initDetailPage(){
  const statusEl = document.getElementById('detail-status');
  const layout = document.getElementById('detail-layout');
  if(!statusEl || !layout) return;
  const slugParam = getRouteParam('slug');
  statusEl.classList.remove('hidden','error');
  layout.classList.add('hidden');
  if(!slugParam){
    statusEl.classList.add('error');
    statusEl.textContent = 'Không có thông tin xe. Vui lòng chọn từ trang Dòng xe.';
    return;
  }
  statusEl.textContent = 'Đang tải dữ liệu xe...';
  try{
    const vehicles = await ensureVehicleData();
    const slug = decodeURIComponent(slugParam).toLowerCase();
    const vehicle = vehicles.find(v => (v.slug || '').toLowerCase() === slug);
    if(!vehicle){
      statusEl.classList.add('error');
      statusEl.textContent = 'Không tìm thấy xe trong dữ liệu đã đồng bộ.';
      return;
    }
    renderDetailContent(vehicle);
    statusEl.classList.add('hidden');
    layout.classList.remove('hidden');
  }catch(error){
    console.error('Detail load error', error);
    statusEl.classList.add('error');
    statusEl.textContent = `Không thể tải dữ liệu: ${error.message}`;
  }
}

function renderDetailContent(vehicle){
  const imageEl = document.getElementById('detail-image');
  const titleEl = document.getElementById('detail-title');
  const descEl = document.getElementById('detail-description');
  const priceEl = document.getElementById('detail-price');
  const specsEl = document.getElementById('detail-specs');
  const badgeEl = document.getElementById('detail-badge');
  const bookBtn = document.getElementById('detail-book-test');
  const imageUrl = sanitizeUrl(vehicle.imageUrl) || 'https://picsum.photos/seed/honda-detail/1024/640';
  if(imageEl) imageEl.src = imageUrl;
  if(imageEl) imageEl.alt = vehicle.name || 'Honda Vehicle';
  if(titleEl) titleEl.textContent = vehicle.name || 'Honda';
  if(descEl) descEl.textContent = vehicle.description || 'Đang cập nhật mô tả.';
  if(priceEl) priceEl.textContent = vehicle.price ? formatCurrency(vehicle.price) : '';
  if(badgeEl) badgeEl.textContent = vehicle.type || 'Honda Official';
  if(specsEl){
    const specs = collectVehicleHighlights(vehicle);
    specsEl.innerHTML = specs.length ? specs.map(item=>`<li>${escapeHTML(item)}</li>`).join('') : '<li>Thông tin sẽ sớm được cập nhật.</li>';
  }
  if(bookBtn && !bookBtn.dataset.bound){
    bookBtn.dataset.bound = 'true';
    bookBtn.addEventListener('click', ()=> showLeadPopup(true));
  }
}

function collectVehicleHighlights(vehicle){
  if(Array.isArray(vehicle.highlights) && vehicle.highlights.length) return vehicle.highlights;
  if(Array.isArray(vehicle.specs) && vehicle.specs.length) return vehicle.specs;
  if(typeof vehicle.highlights === 'string'){ return splitSpecs(vehicle.highlights); }
  if(typeof vehicle.specs === 'string'){ return splitSpecs(vehicle.specs); }
  const extras = [];
  if(vehicle.type) extras.push(`Phân khúc: ${vehicle.type}`);
  if(vehicle.engine) extras.push(`Động cơ: ${vehicle.engine}`);
  if(vehicle.transmission) extras.push(`Hộp số: ${vehicle.transmission}`);
  if(vehicle.fuel) extras.push(`Nhiên liệu: ${vehicle.fuel}`);
  if(vehicle.drive) extras.push(`Dẫn động: ${vehicle.drive}`);
  return extras;
}

function splitSpecs(value=''){
  return value.split(/\r?\n|\||,/).map(item=>item.trim()).filter(Boolean);
}

