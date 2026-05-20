/* ============================================================
   FF14 Lookbook v2 — app.js
   - Garland Tools API 아이템 검색 + 아이콘
   - 드래그 가능한 글램 카드 (이미지 위 오버레이)
   - localStorage 자동 저장
   - 솔로 / 페어 모드
   ============================================================ */

'use strict';

// ── 상수 ─────────────────────────────────────────────────────
const GARLAND_SEARCH = 'https://www.garlandtools.org/api/search.php';
const GARLAND_ITEM   = 'https://www.garlandtools.org/db/data/item/';
const XIVAPI_ICON    = 'https://xivapi.com';
const STORAGE_KEY    = 'ff14_lookbook_v2';

const SLOTS = ['머리','몸통','손','다리','발','무기','귀걸이','목걸이','팔찌','반지1','반지2','얼굴장식'];

// ── 상태 ─────────────────────────────────────────────────────
let state = {
  looks: [],          // 저장된 룩 목록
  currentLookId: null,
  currentEdit: null,  // 편집 중인 룩 객체 (임시)
  filter: 'all',
};

// 모달 상태
let modalCtx = {
  slotKey: null,   // 'solo', 'left', 'right'
  slotName: null,
  selectedItem: null,
};

// ── 유틸 ─────────────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

function saveToStorage() {
  const toSave = state.looks.map(l => ({
    ...l,
    // 이미지는 base64 dataURL 그대로 저장 (소규모 사용이라 OK)
  }));
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave)); } catch(e) { console.warn('저장 실패:', e); }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state.looks = JSON.parse(raw);
  } catch(e) { state.looks = []; }
}

function iconUrl(iconPath) {
  if (!iconPath) return null;
  // Garland Tools 아이콘 경로 → xivapi cdn
  const num = String(iconPath).padStart(6, '0');
  const folder = num.slice(0, 3) + '000';
  return `${XIVAPI_ICON}/i/${folder}/${num}.png`;
}

// ── 기본 빈 룩 만들기 ────────────────────────────────────────
function newLook(isPair = false) {
  const look = {
    id: uid(),
    name: '새 글램 세트',
    isPair,
    desc: '',
    solo: {
      charName: '',
      job: '',
      img: null,
      items: {},    // { '머리': { name, icon, dye1, dye2 }, ... }
      cardPositions: {}, // { '머리': { x, y }, ... }
    },
    left: {
      charName: '',
      job: '',
      img: null,
      items: {},
      cardPositions: {},
    },
    right: {
      charName: '',
      job: '',
      img: null,
      items: {},
      cardPositions: {},
    },
  };
  return look;
}

// ── 글램 카드 기본 위치 계산 ──────────────────────────────────
function defaultCardPositions(slots, containerW, containerH) {
  const positions = {};
  const startX = 16;
  const startY = 20;
  const gapY   = 54;
  slots.forEach((slot, i) => {
    positions[slot] = { x: startX, y: startY + i * gapY };
  });
  return positions;
}

// ============================================================
//  뷰 전환
// ============================================================
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + id).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.view === id);
  });
}

// ============================================================
//  갤러리 렌더
// ============================================================
function renderGallery() {
  const grid = document.getElementById('gallery-grid');
  const empty = document.getElementById('gallery-empty');

  const filtered = state.looks.filter(l => {
    if (state.filter === 'all') return true;
    if (state.filter === 'solo') return !l.isPair;
    if (state.filter === 'pair') return l.isPair;
  });

  if (filtered.length === 0) {
    grid.innerHTML = '';
    grid.appendChild(empty);
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  grid.innerHTML = filtered.map(look => {
    const src = look.isPair
      ? (look.left.img || look.right.img)
      : look.solo.img;
    const job = look.isPair
      ? [look.left.job, look.right.job].filter(Boolean).join(' / ')
      : look.solo.job;
    return `
      <div class="gallery-card" data-id="${look.id}">
        <div class="gallery-card__thumb">
          ${src ? `<img src="${src}" alt="${look.name}"/>` : `<div class="gallery-card__no-img">✦</div>`}
          <span class="gallery-card__badge">${look.isPair ? 'PAIR' : 'SOLO'}</span>
        </div>
        <div class="gallery-card__info">
          <div class="gallery-card__name">${look.name}</div>
          <div class="gallery-card__job">${job || '—'}</div>
        </div>
        <div class="gallery-card__actions">
          <button class="gallery-card__btn" data-action="edit" data-id="${look.id}">편집</button>
          <button class="gallery-card__btn del" data-action="del" data-id="${look.id}">삭제</button>
        </div>
      </div>`;
  }).join('');

  // 업데이트 후 사이드바도 갱신
  renderSidebar();
}

function renderSidebar() {
  const wrap = document.getElementById('sidebar-looks');
  wrap.innerHTML = state.looks.map(l => `
    <div class="sidebar-look-item${state.currentLookId===l.id?' active':''}" data-id="${l.id}">
      <div class="sidebar-look-item__name">${l.name}</div>
      <div class="sidebar-look-item__meta">${l.isPair ? 'PAIR' : 'SOLO'}${l.solo?.job||l.left?.job ? ' · '+(l.solo?.job||l.left?.job) : ''}</div>
    </div>
  `).join('');
}

// ============================================================
//  에디터 열기
// ============================================================
function openEditor(lookId) {
  let look;
  if (lookId) {
    look = JSON.parse(JSON.stringify(state.looks.find(l => l.id === lookId)));
  } else {
    look = newLook(false);
  }
  state.currentEdit = look;
  state.currentLookId = look.id;

  // UI 세팅
  document.getElementById('look-name-input').value = look.name;
  document.getElementById('pair-check').checked = look.isPair;
  document.getElementById('solo-char-name').value = look.solo.charName || '';
  document.getElementById('solo-job').value = look.solo.job || '';
  document.getElementById('solo-desc').value = look.desc || '';
  document.getElementById('left-char-name').value = look.left.charName || '';
  document.getElementById('left-job').value = look.left.job || '';
  document.getElementById('right-char-name').value = look.right.charName || '';
  document.getElementById('right-job').value = look.right.job || '';

  setPairMode(look.isPair);
  renderSlots();
  renderCanvas();
  showView('editor');
}

function setPairMode(isPair) {
  const soloCanvas = document.getElementById('solo-canvas');
  const pairCanvas = document.getElementById('pair-canvas');
  soloCanvas.style.display = isPair ? 'none' : 'block';
  pairCanvas.style.display = isPair ? 'block' : 'none';

  const tabs = document.getElementById('panel-tabs');
  if (isPair) {
    tabs.innerHTML = `
      <button class="panel-tab active" data-target="tab-left">캐릭터 1</button>
      <button class="panel-tab" data-target="tab-right">캐릭터 2</button>`;
    document.getElementById('tab-solo').style.display = 'none';
    document.getElementById('tab-left').style.display  = 'flex';
    document.getElementById('tab-right').style.display = 'none';
  } else {
    tabs.innerHTML = `<button class="panel-tab active" data-target="tab-solo">글램 정보</button>`;
    document.getElementById('tab-solo').style.display  = 'flex';
    document.getElementById('tab-left').style.display  = 'none';
    document.getElementById('tab-right').style.display = 'none';
  }
  bindPanelTabs();
}

function bindPanelTabs() {
  document.querySelectorAll('.panel-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.panel-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      ['tab-solo','tab-left','tab-right'].forEach(id => {
        document.getElementById(id).style.display = 'none';
      });
      document.getElementById(btn.dataset.target).style.display = 'flex';
    });
  });
}

// ── 슬롯 렌더 ────────────────────────────────────────────────
function renderSlots() {
  renderSlotsFor('slots-solo', 'solo');
  renderSlotsFor('slots-left', 'left');
  renderSlotsFor('slots-right', 'right');
}

function renderSlotsFor(containerId, sideKey) {
  const look = state.currentEdit;
  const container = document.getElementById(containerId);
  container.innerHTML = SLOTS.map(slot => {
    const item = look[sideKey].items[slot];
    const isFilled = item && item.name;
    return `
      <div class="slot-row ${isFilled ? 'filled' : ''}" data-side="${sideKey}" data-slot="${slot}">
        <span class="slot-row__label">${slot}</span>
        <div class="slot-row__icon">
          ${isFilled && item.icon ? `<img src="${iconUrl(item.icon)}" onerror="this.style.display='none'"/>` : '＋'}
        </div>
        <div class="slot-row__info">
          ${isFilled
            ? `<div class="slot-row__name">${item.name}</div>
               ${(item.dye1||item.dye2) ? `<div class="slot-row__dye">${[item.dye1,item.dye2].filter(Boolean).join(' / ')}</div>` : ''}`
            : `<div class="slot-row__empty">슬롯 추가</div>`
          }
        </div>
        ${isFilled ? `<button class="slot-row__del" data-side="${sideKey}" data-slot="${slot}">✕</button>` : ''}
      </div>`;
  }).join('');

  // 슬롯 클릭 → 모달
  container.querySelectorAll('.slot-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.slot-row__del')) return;
      openItemModal(row.dataset.side, row.dataset.slot);
    });
  });
  // 삭제 버튼
  container.querySelectorAll('.slot-row__del').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const {side, slot} = btn.dataset;
      delete state.currentEdit[side].items[slot];
      delete state.currentEdit[side].cardPositions[slot];
      renderSlots();
      renderCanvas();
    });
  });
}

// ── 캔버스 렌더 ──────────────────────────────────────────────
function renderCanvas() {
  const look = state.currentEdit;
  if (!look) return;

  // 솔로 이미지
  setCanvasImage('solo-img', 'solo-drop', look.solo.img);
  // 페어 이미지
  setCanvasImage('pair-img-left',  'pair-drop-left',  look.left.img);
  setCanvasImage('pair-img-right', 'pair-drop-right', look.right.img);

  // 글램 카드 레이어
  renderGlamCards('solo-cards-layer', 'solo');
  renderGlamCards('pair-cards-left',  'left');
  renderGlamCards('pair-cards-right', 'right');
}

function setCanvasImage(imgId, dropId, src) {
  const img  = document.getElementById(imgId);
  const drop = document.getElementById(dropId);
  if (src) {
    img.src = src;
    img.style.display = 'block';
    drop.querySelector('.drop-hint').style.display = 'none';
    drop.classList.add('has-image');
  } else {
    img.style.display = 'none';
    if (drop.querySelector('.drop-hint')) drop.querySelector('.drop-hint').style.display = 'flex';
    drop.classList.remove('has-image');
  }
}

function renderGlamCards(layerId, sideKey) {
  const look = state.currentEdit;
  const layer = document.getElementById(layerId);
  layer.innerHTML = '';

  const filled = SLOTS.filter(s => look[sideKey].items[s]?.name);
  if (filled.length === 0) return;

  // 캔버스 컨테이너 크기 가져오기 (렌더 후)
  requestAnimationFrame(() => {
    const layerRect = layer.getBoundingClientRect();
    const W = layerRect.width;
    const H = layerRect.height;

    filled.forEach((slot, i) => {
      const item = look[sideKey].items[slot];
      const pos  = look[sideKey].cardPositions[slot] || { x: 16, y: 16 + i * 54 };

      const card = document.createElement('div');
      card.className = 'glam-card';
      card.dataset.slot = slot;
      card.dataset.side = sideKey;
      card.style.left = pos.x + 'px';
      card.style.top  = pos.y + 'px';

      const dyeHtml = [item.dye1, item.dye2].filter(Boolean)
        .map(d => `<span class="dye-pill">${d}</span>`).join('');

      card.innerHTML = `
        <div class="glam-card__icon">
          ${item.icon
            ? `<img src="${iconUrl(item.icon)}" onerror="this.parentElement.innerHTML='<div class=glam-card__icon-placeholder>${slot}</div>'"/>`
            : `<div class="glam-card__icon-placeholder">${slot}</div>`}
        </div>
        <div class="glam-card__info">
          <div class="glam-card__slot-tag">${slot}</div>
          <div class="glam-card__name">${item.name}</div>
          ${dyeHtml ? `<div class="glam-card__dye">${dyeHtml}</div>` : ''}
        </div>`;

      makeDraggable(card, layer, sideKey, slot);
      layer.appendChild(card);
    });
  });
}

// ── 드래그 ───────────────────────────────────────────────────
function makeDraggable(card, layer, sideKey, slot) {
  let startX, startY, startLeft, startTop;

  card.addEventListener('mousedown', (e) => {
    e.preventDefault();
    card.classList.add('dragging');
    startX = e.clientX;
    startY = e.clientY;
    startLeft = parseInt(card.style.left) || 0;
    startTop  = parseInt(card.style.top)  || 0;

    function onMove(e) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const newLeft = Math.max(0, startLeft + dx);
      const newTop  = Math.max(0, startTop  + dy);
      card.style.left = newLeft + 'px';
      card.style.top  = newTop  + 'px';
    }
    function onUp(e) {
      card.classList.remove('dragging');
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      state.currentEdit[sideKey].cardPositions[slot] = {
        x: Math.max(0, startLeft + dx),
        y: Math.max(0, startTop  + dy),
      };
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  // 터치 지원
  card.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    startX = t.clientX; startY = t.clientY;
    startLeft = parseInt(card.style.left)||0;
    startTop  = parseInt(card.style.top)||0;
    function onMove(e) {
      const tt = e.touches[0];
      card.style.left = Math.max(0, startLeft + tt.clientX - startX) + 'px';
      card.style.top  = Math.max(0, startTop  + tt.clientY - startY) + 'px';
    }
    function onEnd(e) {
      const t2 = e.changedTouches[0];
      state.currentEdit[sideKey].cardPositions[slot] = {
        x: Math.max(0, startLeft + t2.clientX - startX),
        y: Math.max(0, startTop  + t2.clientY - startY),
      };
      card.removeEventListener('touchmove', onMove);
      card.removeEventListener('touchend', onEnd);
    }
    card.addEventListener('touchmove', onMove, { passive: true });
    card.addEventListener('touchend', onEnd);
  }, { passive: true });
}

// ============================================================
//  아이템 검색 모달
// ============================================================
function openItemModal(sideKey, slotName) {
  modalCtx = { slotKey: sideKey, slotName, selectedItem: null };
  document.getElementById('modal-slot-label').textContent = slotName + ' 아이템 선택';
  document.getElementById('modal-search-input').value = '';
  document.getElementById('modal-results').innerHTML = '<div class="modal-hint">아이템 이름을 입력해서 검색하세요</div>';
  document.getElementById('modal-dye-row').style.display = 'none';
  document.getElementById('dye1-input').value = '';
  document.getElementById('dye2-input').value = '';
  document.getElementById('item-modal').style.display = 'flex';

  // 기존 값 복원
  const existing = state.currentEdit[sideKey].items[slotName];
  if (existing) {
    document.getElementById('dye1-input').value = existing.dye1 || '';
    document.getElementById('dye2-input').value = existing.dye2 || '';
  }
  setTimeout(() => document.getElementById('modal-search-input').focus(), 50);
}

async function searchItems(query) {
  if (!query.trim()) return;
  const results = document.getElementById('modal-results');
  results.innerHTML = '<div class="modal-loading">검색 중...</div>';

  try {
    // Garland Tools 검색
    const url = `${GARLAND_SEARCH}?text=${encodeURIComponent(query)}&lang=en&type=item`;
    const res = await fetch(url);
    const data = await res.json();

    // 최대 20개
    const items = (data || []).slice(0, 20);

    if (items.length === 0) {
      results.innerHTML = '<div class="modal-hint">결과가 없어요. 영어로도 시도해보세요.</div>';
      return;
    }

    results.innerHTML = items.map(item => {
      const iconNum = String(item.icon || '').padStart(6, '0');
      const iconFolder = iconNum.slice(0, 3) + '000';
      const iconSrc = item.icon ? `${XIVAPI_ICON}/i/${iconFolder}/${iconNum}.png` : '';
      return `
        <div class="result-item" data-id="${item.id}" data-name="${escHtml(item.name)}" data-icon="${item.icon||''}">
          <div class="result-item__icon">
            ${iconSrc ? `<img src="${iconSrc}" onerror="this.style.display='none'"/>` : ''}
          </div>
          <div class="result-item__info">
            <div class="result-item__name">${escHtml(item.name)}</div>
            <div class="result-item__sub">ID: ${item.id}</div>
          </div>
        </div>`;
    }).join('');

    results.querySelectorAll('.result-item').forEach(el => {
      el.addEventListener('click', () => {
        results.querySelectorAll('.result-item').forEach(r => r.classList.remove('selected'));
        el.classList.add('selected');
        modalCtx.selectedItem = {
          name: el.dataset.name,
          icon: el.dataset.icon,
        };
        document.getElementById('modal-dye-row').style.display = 'flex';
      });
    });

  } catch(e) {
    results.innerHTML = '<div class="modal-hint">검색 오류. 네트워크를 확인해주세요.</div>';
    console.error(e);
  }
}

function confirmItemSelection() {
  const item = modalCtx.selectedItem;
  if (!item) {
    alert('아이템을 선택해주세요.');
    return;
  }
  const dye1 = document.getElementById('dye1-input').value.trim();
  const dye2 = document.getElementById('dye2-input').value.trim();

  state.currentEdit[modalCtx.slotKey].items[modalCtx.slotName] = {
    name: item.name,
    icon: item.icon,
    dye1, dye2,
  };
  // 위치 초기화 (새 아이템이면 기본 위치)
  if (!state.currentEdit[modalCtx.slotKey].cardPositions[modalCtx.slotName]) {
    const filledCount = Object.keys(state.currentEdit[modalCtx.slotKey].items).length - 1;
    state.currentEdit[modalCtx.slotKey].cardPositions[modalCtx.slotName] = {
      x: 16,
      y: 16 + filledCount * 54,
    };
  }

  closeModal();
  renderSlots();
  renderCanvas();
}

function closeModal() {
  document.getElementById('item-modal').style.display = 'none';
  modalCtx = { slotKey: null, slotName: null, selectedItem: null };
}

function escHtml(str) {
  return String(str).replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[m]);
}

// ============================================================
//  저장 / 다운로드
// ============================================================
function saveLook() {
  const look = state.currentEdit;
  look.name  = document.getElementById('look-name-input').value.trim() || '새 글램 세트';
  look.desc  = document.getElementById('solo-desc').value.trim();
  look.isPair = document.getElementById('pair-check').checked;
  look.solo.charName = document.getElementById('solo-char-name').value.trim();
  look.solo.job      = document.getElementById('solo-job').value.trim();
  look.left.charName = document.getElementById('left-char-name').value.trim();
  look.left.job      = document.getElementById('left-job').value.trim();
  look.right.charName= document.getElementById('right-char-name').value.trim();
  look.right.job     = document.getElementById('right-job').value.trim();

  const idx = state.looks.findIndex(l => l.id === look.id);
  if (idx >= 0) state.looks[idx] = look;
  else state.looks.unshift(look);

  saveToStorage();
  renderGallery();

  // 저장 완료 피드백
  const btn = document.getElementById('btn-save');
  btn.textContent = '✓ 저장됨';
  setTimeout(() => btn.textContent = '저장', 1500);
}

async function downloadCanvas() {
  const look = state.currentEdit;
  const target = look.isPair
    ? document.getElementById('pair-canvas')
    : document.getElementById('solo-canvas');

  const btn = document.getElementById('btn-download');
  btn.textContent = '저장 중...';

  try {
    const canvas = await html2canvas(target, {
      backgroundColor: '#0a0910',
      useCORS: true,
      allowTaint: true,
      scale: 2,
    });
    const link = document.createElement('a');
    link.download = (look.name || 'lookbook') + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch(e) {
    alert('이미지 저장 실패: ' + e.message);
  }
  btn.textContent = '↓ 저장';
}

// ── 이미지 파일 읽기 ─────────────────────────────────────────
function readImageFile(file, callback) {
  const reader = new FileReader();
  reader.onload = e => callback(e.target.result);
  reader.readAsDataURL(file);
}

function bindDropZone(dropId, fileInputId, sideKey, imgKey) {
  const drop  = document.getElementById(dropId);
  const input = document.getElementById(fileInputId);

  drop.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    if (input.files[0]) {
      readImageFile(input.files[0], src => {
        state.currentEdit[sideKey][imgKey] = src;
        renderCanvas();
      });
    }
  });
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.style.borderColor = 'var(--gold)'; });
  drop.addEventListener('dragleave', () => drop.style.borderColor = '');
  drop.addEventListener('drop', e => {
    e.preventDefault();
    drop.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      readImageFile(file, src => {
        state.currentEdit[sideKey][imgKey] = src;
        renderCanvas();
      });
    }
  });
}

// ============================================================
//  이벤트 바인딩
// ============================================================
function bindEvents() {
  // 갤러리 버튼
  document.getElementById('btn-new-look').addEventListener('click', () => openEditor(null));
  document.getElementById('btn-new-look-empty')?.addEventListener('click', () => openEditor(null));

  // 사이드바 "새 룩"
  document.querySelector('.nav-btn[data-view="editor"]')?.addEventListener('click', () => openEditor(null));
  document.querySelector('.nav-btn[data-view="gallery"]')?.addEventListener('click', () => {
    showView('gallery');
    renderGallery();
  });

  // 갤러리 카드 클릭
  document.getElementById('gallery-grid').addEventListener('click', e => {
    const card = e.target.closest('.gallery-card');
    const btn  = e.target.closest('.gallery-card__btn');
    if (btn) {
      const id = btn.dataset.id;
      if (btn.dataset.action === 'edit') openEditor(id);
      if (btn.dataset.action === 'del') {
        if (confirm('이 룩을 삭제할까요?')) {
          state.looks = state.looks.filter(l => l.id !== id);
          saveToStorage();
          renderGallery();
        }
      }
      return;
    }
    if (card) openEditor(card.dataset.id);
  });

  // 사이드바 룩 클릭
  document.getElementById('sidebar-looks').addEventListener('click', e => {
    const item = e.target.closest('.sidebar-look-item');
    if (item) openEditor(item.dataset.id);
  });

  // 에디터 — 뒤로
  document.getElementById('btn-back').addEventListener('click', () => {
    showView('gallery');
    renderGallery();
  });

  // 에디터 — 저장
  document.getElementById('btn-save').addEventListener('click', saveLook);
  document.getElementById('btn-download').addEventListener('click', downloadCanvas);

  // 페어 토글
  document.getElementById('pair-check').addEventListener('change', e => {
    state.currentEdit.isPair = e.target.checked;
    setPairMode(e.target.checked);
    renderSlots();
    renderCanvas();
  });

  // 드롭존 바인딩
  bindDropZone('solo-drop',       'solo-file-input',  'solo',  'img');
  bindDropZone('pair-drop-left',  'pair-file-left',   'left',  'img');
  bindDropZone('pair-drop-right', 'pair-file-right',  'right', 'img');

  // 모달 — 검색
  const searchInput = document.getElementById('modal-search-input');
  const searchBtn   = document.getElementById('modal-search-btn');
  searchBtn.addEventListener('click', () => searchItems(searchInput.value));
  searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') searchItems(searchInput.value); });

  // 모달 — 확인
  document.getElementById('modal-confirm').addEventListener('click', confirmItemSelection);
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('item-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('item-modal')) closeModal();
  });

  // 필터
  document.querySelectorAll('.filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.filter = btn.dataset.filter;
      renderGallery();
    });
  });
}

// ============================================================
//  초기화
// ============================================================
function init() {
  loadFromStorage();
  bindEvents();
  renderGallery();
  renderSidebar();
  showView('gallery');
}

document.addEventListener('DOMContentLoaded', init);
