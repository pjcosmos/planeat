/* =========================
   script.js  (FULL REPLACEMENT)
   - 기존 기능 유지 / 충돌 정리
   - 검색 UI 인라인 고정(돋보기 옆)
   - DAY 뷰 = 00:00~23:59 타임라인 + 실시간 파란선(now-line)
   ========================= */

/* ===== 알림 환경 진단 유틸 ===== */
function isSecureOrigin() {
  return location.protocol === 'https:' ||
         location.hostname === 'localhost' ||
         location.hostname === '127.0.0.1';
}
function inIframe() {
  try { return window.self !== window.top; } catch { return true; }
}
function notifyState() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

/* ===== 공통 유틸 ===== */
const $  = (s,p=document)=>p.querySelector(s);
const $$ = (s,p=document)=>Array.from(p.querySelectorAll(s));
const on = (el,ev,fn)=>el && el.addEventListener(ev,fn);

/* 날짜 키(일 단위) */
function keyOf(d){
  const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return dd.toDateString(); // 예: "Fri Oct 31 2025"
}
function load(d){
  try { return JSON.parse(localStorage.getItem(keyOf(d))) || { memos:[], todos:[] }; }
  catch { return { memos:[], todos:[] }; }
}
function save(d, data){
  localStorage.setItem(keyOf(d), JSON.stringify(data||{memos:[],todos:[]}));
}
function countEvents(d){
  const e = load(d);
  return (e.memos?.length||0) + (e.todos?.length||0);
}
function normalizeCategory(raw){
  if (!raw) return '';
  const m = String(raw).toLowerCase();
  if (m === '아침' || m === 'morning') return 'morning';
  if (m === '점심' || m === 'lunch')   return 'lunch';
  if (m === '저녁' || m === 'dinner')  return 'dinner';
  if (m === '카페' || m === 'cafe')    return 'cafe';
  return raw;
}
function formatCompactDate(d){
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${yy}.${mm}.${dd}`;
}

/* ===== 아이콘(모노) ===== */
const ICONS = {
  trashMono: `
    <svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 6h16"/>
      <path d="M10 10v7M14 10v7"/>
      <rect x="6" y="6" width="12" height="14" rx="2"/>
      <path d="M9 6V4a1 1 0 0 1 1-1h4a 1 1 0 0 1 1 1v2"/>
    </svg>`,
  pencilMono: `
    <svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 20h9"/>
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z"/>
    </svg>`,
  calendarMono: `
    <svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="4" width="18" height="17" rx="3"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>`,
  edit:  `<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>`,
  trash: `<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a 1 1 0 0 1 1 1v2"/></svg>`,
  photo:`<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 15l-5-5-7 7"/></svg>`
};
const CATEGORY_LABELS = { morning:'아침', lunch:'점심', dinner:'저녁', cafe:'카페' };

// 🔎 검색 패널 최소 글자수 (0이면 아무 글자 없이도 열림)
const SEARCH_MIN_CHARS = 2;


/* ===== 월 칸 요약 배지 ===== */
function buildMonthCountBadge(date){
  const ev = load(date);
  const memos = Array.isArray(ev.memos) ? ev.memos.filter(m => (m?.restaurantName||'').trim()) : [];
  if (memos.length === 0) return null;

  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.justifyContent = 'flex-end';
  const pill = document.createElement('span');
  pill.textContent = `${memos.length}`;
  pill.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:0 8px;border-radius:9999px;border:1px solid var(--line,#e9e2d9);background:#fff;font-weight:700;font-size:12px;';
  wrap.appendChild(pill);
  return wrap;
}

/* ===== 검색 데이터 수집/캐시 ===== */
function _toYMDFromLocalKey(k) {
  try {
    const d = new Date(k);
    if (isNaN(d)) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const da = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${da}`;
  } catch { return ''; }
}
function collectAllRestaurants() {
  const rows = [];
  for (let i=0;i<localStorage.length;i++){
    const k = localStorage.key(i);
    const ymd = _toYMDFromLocalKey(k);
    if (!ymd) continue;
    let obj;
    try { obj = JSON.parse(localStorage.getItem(k)||'null'); } catch { obj=null; }
    if (!obj || !Array.isArray(obj.memos)) continue;
    obj.memos.forEach(m=>{
      const name = (m?.restaurantName||'').trim();
      if (!name) return;
      const t = typeof m.ts === 'number' ? m.ts : new Date(ymd).getTime();
      rows.push({ name, ymd, ts: t });
    });
  }
  rows.sort((a,b)=> b.ts - a.ts);
  return rows;
}
let ALL_RESTAURANTS = [];
function refreshAllRestaurants(){ ALL_RESTAURANTS = collectAllRestaurants(); }
window.addEventListener('storage', refreshAllRestaurants);

/* ===== 검색 렌더(인라인) ===== */
function renderSearchList(q = '') {
    const resultsBox = document.getElementById('searchResults');
    if (!resultsBox) return;
  
    const query = String(q || '').trim();
    // ✅ 최소 글자수 미달 시 표시 안 함
    if (query.length < SEARCH_MIN_CHARS) {
      resultsBox.innerHTML = '';
      return;
    }
  
    resultsBox.innerHTML = '';
    const rows = (ALL_RESTAURANTS && ALL_RESTAURANTS.length) ? ALL_RESTAURANTS : collectAllRestaurants();
    const filtered = rows.filter(r => r.name.toLowerCase().includes(query.toLowerCase()));
  
    if (!filtered.length){
      const empty = document.createElement('div');
      empty.className = 'muted';
      empty.style.padding = '10px';
      empty.textContent = '검색 결과가 없어요.';
      resultsBox.appendChild(empty);
      return;
    }

  filtered.forEach(item=>{
    const row = document.createElement('button');
    row.type='button';
    row.className='sr-item';
    row.style.cssText='display:flex;justify-content:space-between;align-items:center;width:100%;padding:8px 10px;border:1px solid var(--line,#eee);border-radius:10px;background:#fff;margin:4px 0;cursor:pointer;';
    const left = document.createElement('div'); left.textContent=item.name; left.style.fontWeight='700';
    const right = document.createElement('div'); right.textContent = `${item.ymd.slice(2,4)}.${item.ymd.slice(5,7)}.${item.ymd.slice(8,10)}`; right.className='muted';
    row.append(left,right);
    row.addEventListener('click', ()=>{
      const [y,m,d] = item.ymd.split('-').map(n=>parseInt(n,10));
      activeDate = new Date(y, m-1, 1);
      renderCalendar();
      openModal(new Date(y, m-1, d));
      closeSearchPanel();
    });
    resultsBox.appendChild(row);
  });
}

/* ===== 검색 UI 구축(돋보기 옆 인라인 고정) ===== */
function mountSearchInline() {
  const controls = document.querySelector('.calendar-controls');
  if (!controls) return;

  let btn   = document.getElementById('searchBtn')   || document.querySelector('.search-btn');
  let input = document.getElementById('searchInput');
  let panel = document.getElementById('searchPanel');

  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'searchBtn';
    btn.type = 'button';
    btn.title = '식당명 검색';
    btn.textContent = '🔎';
    btn.className = 'search-btn';
  }
  if (!input) {
    input = document.createElement('input');
    input.id = 'searchInput';
    input.type = 'text';              // 그대로 둬도 OK
    input.placeholder = '식당명 검색…';
  }

  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (q.length >= SEARCH_MIN_CHARS) {
      openSearchPanel();
      renderSearchList(q);
    } else {
      closeSearchPanel();
    }
  });
  // 🔒 자동완성/교정/맞춤법/패스워드매니저/입력기록 끄기
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('autocorrect', 'off');
  input.setAttribute('autocapitalize', 'off');
  input.setAttribute('spellcheck', 'false');
  // 크롬이 name값 기준으로 기록을 붙이는 걸 피하기 위해 랜덤 name 부여
  input.setAttribute('name', 'planeat_search_' + Math.random().toString(36).slice(2));
  // 일부 패스워드 매니저 무시
  input.setAttribute('data-lpignore', 'true');
  input.setAttribute('data-form-type', 'other');
  // 엔터로 폼 제출되는 일 방지
  
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'searchPanel';
    panel.setAttribute('aria-hidden','true');
    const list = document.createElement('div');
    list.id = 'searchResults';
    panel.appendChild(list);
  }

  let wrap = controls.querySelector('.search-wrap');
  if (!wrap) { wrap = document.createElement('div'); wrap.className='search-wrap'; controls.appendChild(wrap); }

  let inputBox = wrap.querySelector('.search-inputbox');
  if (!inputBox) { inputBox = document.createElement('div'); inputBox.className='search-inputbox'; }

  inputBox.innerHTML = '';
  inputBox.appendChild(input);
  inputBox.appendChild(panel);

  wrap.innerHTML = '';
  wrap.appendChild(btn);
  wrap.appendChild(inputBox);

  // 스타일(한 번만)
  if (!document.getElementById('planeat-searchbar-style')) {
    const css = `
      .calendar-controls{display:flex;align-items:center;gap:10px;flex-wrap:nowrap;}
      .calendar-controls>*{flex:0 0 auto;}
      .search-wrap{display:flex;align-items:center;gap:8px;}
      .search-inputbox{position:relative;}
      #searchInput{width:260px;max-width:260px;}
      #searchPanel{
        position:absolute;left:0;right:0;top:calc(100% + 8px);
        z-index:9999;display:none;background:#fff;border:1px solid #e5e7eb;
        border-radius:12px;box-shadow:0 10px 24px rgba(0,0,0,.08);
        padding:10px;max-height:320px;overflow:auto;
      }
      #searchPanel[aria-hidden="false"]{display:block;}
      #searchPanel .muted{color:#9aa0a6;font-size:12px;}
    `;
    const tag = document.createElement('style');
    tag.id = 'planeat-searchbar-style';
    tag.textContent = css;
    document.head.appendChild(tag);
  }

  // 동작
  btn.onclick = (e) => {
    e.stopPropagation();
    const q = (input.value || '').trim();
    const isClosed = panel.getAttribute('aria-hidden') !== 'false';
    if (isClosed) {
      if (q.length >= SEARCH_MIN_CHARS) {
        openSearchPanel(); renderSearchList(q);
      }
      input.focus(); // 입력 유도
    } else {
      closeSearchPanel();
    }
  };
    input.addEventListener('focus', (e)=>{ e.stopPropagation(); openSearchPanel(); });
  input.addEventListener('input', ()=> renderSearchList(input.value) );

  // 외부 클릭 닫기
  document.removeEventListener('click', window.__searchOutsideHandler || (()=>{}));
  window.__searchOutsideHandler = (e)=>{
    if (panel.getAttribute('aria-hidden')==='true') return;
    const inside = e.target.closest('.search-inputbox') || e.target.closest('#searchBtn');
    if (!inside) closeSearchPanel();
  };
  document.addEventListener('click', window.__searchOutsideHandler);
}
function openSearchPanel(){
  const panel = document.getElementById('searchPanel');
  const input = document.getElementById('searchInput');
  if (!panel) return;
  panel.setAttribute('aria-hidden','false');
  renderSearchList('');
  input && setTimeout(()=> input.focus(), 0);
}
function closeSearchPanel(){
  const panel = document.getElementById('searchPanel');
  if (!panel) return;
  panel.setAttribute('aria-hidden','true');
}

/* ===== 알림 헬퍼 ===== */
const ALARM_FIRED_KEY = 'firedAlarms'; // { [occKey]: true }
function aid() { return 'a' + Math.random().toString(36).slice(2) + Date.now().toString(36); }
async function ensureNotificationPermission(force=false) {
  if (!('Notification' in window)) return false;
  if (!isSecureOrigin()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied' && !force) return false;
  try {
    const res = await Notification.requestPermission();
    return res === 'granted';
  } catch { return false; }
}

/* ===== 전역 상태 ===== */
let activeDate      = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let currentView     = 'month'; // 'month' | 'week' | 'day'
let dayViewDate     = new Date();
let selectedDate    = null;
let selectedCategory= '';
let photoBase64     = '';
let memoPhotos      = [];
let coverIdx        = 0;
let editingMemoIndex= null;
let editingTodoIndex= null;

/* ===== DOM 참조 ===== */
const calendarGrid     = document.getElementById('calendarGrid');
const currentMonthYear = document.getElementById('currentMonthYear') || (()=>{
  const h = document.createElement('h2'); h.id='currentMonthYear'; (document.querySelector('.calendar-controls')||document.body).appendChild(h); return h;
})();
const weekOptions      = document.getElementById('weekOptions') || (()=>{
  const d = document.createElement('div'); d.id='weekOptions'; document.body.appendChild(d); return d;
})();
const monthViewBtn     = $('#monthView');
const weekViewBtn      = $('#weekView');
const highlightViewBtn = $('#highlightView');
const todayBtn         = $('#todayBtn');
const prevMonthBtn     = $('#prevMonth');
const nextMonthBtn     = $('#nextMonth');

const eventModal   = $('#eventModal');
const modalDate    = $('#modalDate');
const closeBtn     = $('.close-button');
const modalContent = $('#eventModal .modal-content');

const savedMemosDiv = $('#savedMemos');
const savedTodosUl  = $('#savedTodos');

// 메모 폼
const memoForm      = $('#memoForm');
const categoryWrap  = $('.memo-categories');
const restaurantNameInput = $('#restaurantName');
const photoUploadInput    = $('#photoUpload');
const memoTextInput       = $('#memoText');
const addMemoBtn          = $('#addMemoBtn');
const photoIconBtn        = $('#photoIconBtn');

// 투두 폼
const todoForm        = $('#todoForm');
const todoInput       = $('#todoInput');
const addTodoBtn      = $('#addTodoBtn');
const todoTimeBtn     = $('#todoTimeBtn');
const timePopover     = $('#timePopover');
const todoTimePopup   = $('#todoTimePopup');
const todoTimeDisplay = $('#todoTimeDisplay');

/* ===== 토글(자동 배선) ===== */
(function wireToggles(){
  const headers = $$('.toggle-header');
  if (!headers.length) return;
  headers.forEach(header=>{
    const targetId = header.dataset.target;
    const content = targetId ? document.getElementById(targetId) : header.nextElementSibling;
    if (!content) return;
    content.classList.add('toggle-content');
    const initiallyOpen = content.classList.contains('open') || header.dataset.open === 'true';
    content.classList.toggle('open', initiallyOpen);
    header.setAttribute('aria-expanded', String(initiallyOpen));
    on(header,'click', ()=>{
      const willOpen = !content.classList.contains('open');
      content.classList.toggle('open', willOpen);
      header.setAttribute('aria-expanded', String(willOpen));
      if (willOpen && modalContent) modalContent.scrollTop = header.offsetTop - 10;
    });
  });
})();

/* ===== 모달 ===== */
function openModal(date) {
  if (!eventModal || !modalDate) return;
  selectedDate = new Date(date);
  modalDate.textContent = selectedDate.toLocaleDateString('ko-KR', {year:'numeric', month:'long', day:'numeric', weekday:'long'});
  clearMemoInputs();
  clearTodoInput();
  editingMemoIndex = null;
  editingTodoIndex = null;
  renderSaved();
  eventModal.setAttribute('aria-hidden','false');
  eventModal.style.display = 'flex';
  document.body.classList.add('modal-open');
  if (modalContent) modalContent.scrollTop = 0;
}
function closeModal() {
  if (!eventModal) return;
  eventModal.setAttribute('aria-hidden','true');
  eventModal.style.display = 'none';
  document.body.classList.remove('modal-open');
}
on(closeBtn,'click',closeModal);
on(document,'keydown',(e)=>{ if(e.key==='Escape') closeModal(); });
on(eventModal,'click',(e)=>{ if(e.target===eventModal) closeModal(); });

/* ===== 저장 목록 렌더 ===== */
function renderSaved() {
  if (!selectedDate) return;
  const { memos, todos } = load(selectedDate);

  // MEMOS
  savedMemosDiv.innerHTML = '';
  if (!memos.length) {
    savedMemosDiv.innerHTML = `<div class="muted">저장된 메모가 없습니다.</div>`;
  } else {
    const rank = { '': -1, morning: 0, lunch: 1, dinner: 2, cafe: 3 };
    const displayMemos = (memos || [])
      .map((m, i) => ({ ...m, _i: i, category: normalizeCategory(m.category || '') }))
      .sort((a,b)=> (rank[a.category]??99)-(rank[b.category]??99) || (a._i - b._i));

    displayMemos.forEach((m) => {
      const idx = m._i;
      const isEditing = editingMemoIndex === idx;

      const wrap = document.createElement('div');
      wrap.className = 'saved-memo-item';

      const actions = document.createElement('div');
      actions.className = 'item-actions';
      const ebtn = document.createElement('button'); ebtn.className='icon-btn'; ebtn.title='수정'; ebtn.innerHTML = ICONS.edit;
      const dbtn = document.createElement('button'); dbtn.className='icon-btn'; dbtn.title='삭제'; dbtn.innerHTML = ICONS.trash;
      actions.append(ebtn, dbtn);
      wrap.appendChild(actions);

      ebtn.addEventListener('click', ()=>{ editingMemoIndex = (isEditing ? null : idx); renderSaved(); });
      dbtn.addEventListener('click', ()=>{
        if(!confirm('이 메모를 삭제할까요?')) return;
        const data = load(selectedDate); data.memos.splice(idx,1); save(selectedDate,data);
        renderSaved(); renderCalendar();
      });

      if (!isEditing) {
        const title = document.createElement('h5');
        const cat = m.category; // ''|morning|lunch|dinner|cafe
        const catLabel = cat ? (CATEGORY_LABELS[cat] || cat) : '';
        title.textContent = `${catLabel?`[${catLabel}] `:''}${m.restaurantName||''}`;
        if (!cat){
          const dot = document.createElement('span');
          dot.className = 'uncat-dot';
          title.appendChild(dot);
        }
        wrap.appendChild(title);

        const pics = Array.isArray(m.photos) ? m.photos : (m.photo ? [m.photo] : []);
        if (pics.length){
          const cidx = Math.max(0, m.coverIdx || 0);
          const img = document.createElement('img');
          img.src = pics[cidx] || pics[0];
          img.alt = '메모 사진';
          wrap.appendChild(img);
        }
      } else {
        const box=document.createElement('div'); box.className='inline-editor';
        const row1=document.createElement('div'); row1.className='inline-row';
        const titleInput=document.createElement('input'); titleInput.className='input'; titleInput.placeholder='식당 이름'; titleInput.value=m.restaurantName||'';
        const textArea=document.createElement('textarea'); textArea.className='textarea'; textArea.placeholder='메모 내용'; textArea.value=m.memoText||'';
        row1.append(titleInput, textArea);

        // ... 편집 분기 안에서
const row2 = document.createElement('div'); 
row2.className = 'inline-row grid-2';

/* 여러 장 커버 선택 */
let tempPhotos = Array.isArray(m.photos) ? m.photos.slice() : (m.photo ? [m.photo] : []);
let tempCover  = Math.max(0, m.coverIdx || 0);

// 왼쪽: 썸네일 목록
const left = document.createElement('div');
const thumbs = document.createElement('div');
thumbs.style.display = 'flex'; thumbs.style.gap = '6px'; thumbs.style.flexWrap = 'wrap';
function drawThumbs(){
  thumbs.innerHTML = '';
  if (!tempPhotos.length){
    thumbs.innerHTML = '<div class="muted">사진 없음</div>';
    return;
  }
  tempPhotos.forEach((src, i) => {
    const b = document.createElement('button'); b.type='button';
    b.style.cssText = `
      position:relative;width:56px;height:56px;border-radius:10px;overflow:hidden;
      border:2px solid ${i===tempCover ? '#111':'#e5e7eb'};
    `;
    const im = document.createElement('img');
    im.src = src; im.alt = `p${i+1}`;
    im.style.cssText = 'width:100%;height:100%;object-fit:cover;';
    const star = document.createElement('span');
    star.textContent = i===tempCover ? '★' : '☆';
    star.style.cssText = 'position:absolute;right:3px;top:3px;background:#fff;border:1px solid #e5e7eb;border-radius:999px;padding:0 3px;font-size:12px;';
    b.append(im, star);
    b.addEventListener('click', ()=>{ tempCover=i; drawThumbs(); });
    thumbs.appendChild(b);
  });
}
drawThumbs();
left.appendChild(thumbs);

// 오른쪽: 파일 추가 버튼
const right = document.createElement('div');
const hiddenFile = document.createElement('input');
hiddenFile.type='file'; hiddenFile.accept='image/*'; hiddenFile.multiple = true; hiddenFile.className='file-hidden';
const addBtn = document.createElement('button'); 
addBtn.type='button'; addBtn.className='icon-btn'; addBtn.title='사진 추가'; addBtn.innerHTML = ICONS.photo;
addBtn.addEventListener('click', ()=> hiddenFile.click());
hiddenFile.addEventListener('change', async (e)=>{
  const files = Array.from(e.target.files || []);
  const readers = files.map(f => new Promise(res => { const r = new FileReader(); r.onload = ev => res(ev.target.result); r.readAsDataURL(f); }));
  const adds = await Promise.all(readers);
  tempPhotos = tempPhotos.concat(adds).slice(0, 20);
  if (tempPhotos.length && tempCover >= tempPhotos.length) tempCover = tempPhotos.length - 1;
  drawThumbs();
});
right.append(addBtn, hiddenFile);

row2.append(left, right);


        const row3=document.createElement('div'); row3.className='inline-actions';
        const cancel=document.createElement('button'); cancel.className='btn'; cancel.textContent='취소';
        const saveBtn=document.createElement('button'); saveBtn.className='btn primary'; saveBtn.textContent='저장';
        cancel.addEventListener('click',()=>{ editingMemoIndex=null; renderSaved(); });
        saveBtn.addEventListener('click',()=>{
          const data = load(selectedDate);
          const item = data.memos[idx]; if(!item) return;
          item.restaurantName = titleInput.value.trim();
          item.memoText       = textArea.value.trim();
          item.photos         = tempPhotos.slice();
          item.coverIdx       = Math.max(0, Math.min(tempCover, item.photos.length-1));
          item.photo          = item.photos[item.coverIdx] || ''; // 대표 1장 유지
          save(selectedDate, data);
          editingMemoIndex = null;
          renderSaved(); 
          renderCalendar();
        });
        
        row3.append(cancel, saveBtn);

        box.append(row1,row2,row3);
        wrap.appendChild(box);
      }

      savedMemosDiv.appendChild(wrap);
    });
  }

  // TODOS
  savedTodosUl.innerHTML = '';
  if (!todos.length){
    const li=document.createElement('li'); li.className='muted'; li.textContent='저장된 할 일이 없습니다.'; savedTodosUl.appendChild(li);
  } else {
    todos.forEach((t,idx)=>{
      const isEditing = editingTodoIndex===idx;
      const li=document.createElement('li'); li.className='todo-item'+(t.completed?' completed':'');
      const actions=document.createElement('div'); actions.className='item-actions';
      const ebtn=document.createElement('button'); ebtn.className='icon-btn'; ebtn.title='수정';  ebtn.innerHTML=ICONS.edit;
      const dbtn=document.createElement('button'); dbtn.className='icon-btn'; dbtn.title='삭제';  dbtn.innerHTML=ICONS.trash;
      actions.append(ebtn,dbtn);

      const main=document.createElement('div'); main.style.flex='1'; main.style.minWidth='0';
      if(!isEditing){
        const row=document.createElement('div'); row.style.display='flex'; row.style.alignItems='center'; row.style.gap='8px';
        const cb = document.createElement('input'); cb.type='checkbox'; cb.className='todo-check'; cb.checked=!!t.completed;
        cb.addEventListener('change', ()=>{
          const data = load(selectedDate);
          data.todos[idx].completed = cb.checked;
          save(selectedDate, data);
          renderSaved(); renderCalendar();
        });
        row.appendChild(cb);
        if (t.time) { const timeBadge=document.createElement('span'); timeBadge.className='todo-time-badge'; timeBadge.textContent=t.time; row.appendChild(timeBadge); }
        if (t.repeat && t.repeat!=='none'){ const rep=document.createElement('span'); rep.className='todo-time-badge'; rep.textContent=(t.repeat==='daily'?'매일':'매주'); row.appendChild(rep); }
        const text=document.createElement('span'); text.className='todo-text'; text.textContent=t.text;
        row.appendChild(text);
        main.appendChild(row);
      } else {
        const form=document.createElement('div'); form.className='inline-editor';
        const line=document.createElement('div'); line.className='inline-row grid-2';
        const input=document.createElement('input'); input.className='input'; input.value=t.text||'';
        const timeEdit=document.createElement('input'); timeEdit.type='time'; timeEdit.className='input'; timeEdit.value=t.time||'';
        const repeatSelect = document.createElement('select'); repeatSelect.className='input';
        ['none','daily','weekly'].forEach(opt=>{
          const o=document.createElement('option'); o.value=opt; o.textContent=(opt==='none'?'반복 없음': opt==='daily'?'매일 반복':'매주 반복'); repeatSelect.appendChild(o);
        });
        repeatSelect.value = t.repeat || 'none';
        line.append(input, timeEdit, repeatSelect);
        const a=document.createElement('div'); a.className='inline-actions';
        const cancel=document.createElement('button'); cancel.className='btn'; cancel.textContent='취소';
        const saveBtn=document.createElement('button'); saveBtn.className='btn primary'; saveBtn.textContent='저장';
        cancel.addEventListener('click',()=>{ editingTodoIndex=null; renderSaved(); });
        saveBtn.addEventListener('click',()=>{
          const data=load(selectedDate);
          data.todos[idx].text = input.value.trim();
          data.todos[idx].time = String(timeEdit.value||'').trim();
          data.todos[idx].repeat = repeatSelect.value || 'none';
          data.todos[idx]._aid = data.todos[idx]._aid || aid();
          save(selectedDate,data); editingTodoIndex=null; renderSaved(); renderCalendar();
        });
        a.append(cancel, saveBtn);
        form.append(line,a);
        main.appendChild(form);
      }

      ebtn.addEventListener('click',()=>{ editingTodoIndex=(isEditing?null:idx); renderSaved(); });
      dbtn.addEventListener('click',()=>{
        if(!confirm('이 할 일을 삭제할까요?')) return;
        const data=load(selectedDate); data.todos.splice(idx,1); save(selectedDate,data); renderSaved(); renderCalendar();
      });

      li.append(main,actions);
      savedTodosUl.appendChild(li);
    });
  }
}

/* ===== 입력 핸들러 ===== */
function clearMemoInputs(){
  selectedCategory=''; 
  photoBase64='';
  memoPhotos=[];
  coverIdx=0;
  if (restaurantNameInput) restaurantNameInput.value='';
  if (photoUploadInput)    photoUploadInput.value='';
  if (memoTextInput)       memoTextInput.value='';
  $$('.chip',categoryWrap).forEach(c=>c.classList.remove('active'));
}
function clearTodoInput(){ if (todoInput) todoInput.value=''; }

on(categoryWrap,'click',(e)=>{
  const btn=e.target.closest('.chip'); if(!btn) return;
  $$('.chip',categoryWrap).forEach(c=>c.classList.remove('active'));
  btn.classList.add('active');
  selectedCategory=btn.dataset.category||'';
});
on(photoUploadInput,'change', async (e)=>{
  const files = Array.from(e.target.files || []).slice(0, 12); // 최대 12장 정도
  memoPhotos = [];
  coverIdx = 0;

  const readers = files.map(f => new Promise((res) => {
    const r = new FileReader();
    r.onload = ev => res(ev.target.result);
    r.readAsDataURL(f);
  }));
  memoPhotos = await Promise.all(readers);
  renderThumbChooser(); // 미리보기/커버선택 렌더
});

function renderThumbChooser(){
  const box = document.getElementById('photoThumbs');
  if (!box) return;
  box.innerHTML = '';
  if (!memoPhotos.length){
    box.innerHTML = '<div class="muted" style="padding:6px 0;">선택된 사진이 없어요.</div>';
    return;
  }
  memoPhotos.forEach((src, idx) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'thumb-choice';
    item.style.cssText = `
      position:relative;width:64px;height:64px;border-radius:10px;
      overflow:hidden;border:2px solid ${idx===coverIdx ? '#111' : '#e5e7eb'};
    `;
    const img = document.createElement('img');
    img.src = src;
    img.alt = `photo ${idx+1}`;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
    const badge = document.createElement('span');
    badge.textContent = idx===coverIdx ? '★' : '☆';
    badge.style.cssText = `
      position:absolute;right:4px;top:4px;font-size:14px;
      background:#fff;border-radius:999px;padding:0 4px;line-height:1.2;
      border:1px solid #e5e7eb;
    `;
    item.append(img, badge);
    item.addEventListener('click', () => {
      coverIdx = idx;
      renderThumbChooser(); // 다시 그려 테두리/뱃지 업데이트
    });
    box.appendChild(item);
  });
}


on(photoIconBtn,'click',()=>{ photoUploadInput && photoUploadInput.click(); });

on(addMemoBtn,'click',()=>{
  if(!selectedDate) return;
  const name = (restaurantNameInput?.value||'').trim();
  const memoText = (memoTextInput?.value||'').trim();

  // 단 하나도 없으면 경고
  if(!name && !memoText && memoPhotos.length===0){
    alert('메모, 식당 이름 또는 사진 중 하나는 입력해주세요.');
    return;
  }

  const data = load(selectedDate);
  const photos = memoPhotos.slice(); // 복사

  data.memos.push({
    category: normalizeCategory(selectedCategory),
    restaurantName: name,
    memoText,
    photo: photos[coverIdx] || '',  // 하위 호환(대표 1장)
    photos,
    coverIdx: Math.max(0, Math.min(coverIdx, photos.length-1)),
    ts: Date.now()
  });

  save(selectedDate, data);

  // 입력 초기화
  memoPhotos = [];
  coverIdx = 0;
  if (photoUploadInput) photoUploadInput.value = '';
  renderThumbChooser();
  clearMemoInputs();
  renderSaved();
  renderCalendar();
});


on(addTodoBtn,'click',()=>{
  if(!selectedDate) return;
  const text = (todoInput?.value||'').trim();
  let time = (todoTimeDisplay?.textContent || todoTimePopup?.value || '').trim();
  if(!text){ alert('할 일을 입력하세요.'); return; }
  const data = load(selectedDate);
  data.todos.push({ text, time, completed:false, repeat:'none', _aid: aid() });
  save(selectedDate,data);
  if (todoInput) todoInput.value = '';
  if (todoTimePopup) todoTimePopup.value = '';
  if (todoTimeDisplay) todoTimeDisplay.textContent = '';
  renderSaved(); renderCalendar();
});

on(todoTimeBtn,'click',()=>{
  if(!timePopover || !todoTimePopup) return;
  const open = timePopover.classList.toggle('open');
  timePopover.setAttribute('aria-hidden', String(!open));
  if(open){
    todoTimePopup.focus();
    if(typeof todoTimePopup.showPicker === 'function'){ todoTimePopup.showPicker(); }
  }
});
on(todoTimePopup,'change',()=>{
  if(todoTimeDisplay) todoTimeDisplay.textContent = todoTimePopup.value || '';
  if(timePopover){ timePopover.classList.remove('open'); timePopover.setAttribute('aria-hidden','true'); }
});
document.addEventListener('click',(e)=>{
  if(!timePopover) return;
  if(e.target.closest('.time-inline')) return;
  timePopover.classList.remove('open');
  timePopover.setAttribute('aria-hidden','true');
});

// 해당 월의 주차들을 [ [일~토], [일~토], ... ] 형태로 반환
function getWeeksOfMonth(baseDate){
  const y = baseDate.getFullYear();
  const m = baseDate.getMonth();
  const first = new Date(y, m, 1);
  const last  = new Date(y, m + 1, 0);

  // 달력은 "해당 월 첫날이 있는 주의 일요일"부터 시작
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay()); // 일요일

  // "해당 월 마지막 날이 있는 주의 토요일"까지 포함
  const end   = new Date(last);
  end.setDate(last.getDate() + (6 - last.getDay())); // 토요일

  const weeks = [];
  let cursor = new Date(start);
  while (cursor <= end) {
    const days = Array.from({length:7}, (_,i)=> new Date(
      cursor.getFullYear(), cursor.getMonth(), cursor.getDate()+i
    ));
    weeks.push(days);
    cursor.setDate(cursor.getDate()+7);
  }
  return weeks;
}

/* ===== 주 뷰 ===== */
function setDayPhoto(cellEl, src){
  cellEl.classList.add('has-photo');

  let under = cellEl.querySelector('.day-bg-underlay');
  let main  = cellEl.querySelector('.day-bg-img');

  if (!under) {
    under = document.createElement('img');
    under.className = 'day-bg-underlay';
    cellEl.prepend(under);
  }
  if (!main) {
    main = document.createElement('img');
    main.className = 'day-bg-img';
    cellEl.prepend(main);
  }

  // 절대 흐릿/투명 금지
  ['opacity','filter','mixBlendMode'].forEach(k=>{
    under.style[k] = '';
    main.style[k]  = '';
  });

  under.src = src;
  main.src  = src;
}

function renderWeekList(){
  weekOptions.innerHTML = '';

    // 🔁 이 달(=activeDate)만 기준으로 주차 생성
    const base = new Date(activeDate.getFullYear(), activeDate.getMonth(), 1);
    const weeks = getWeeksOfMonthStrict(base);

  // 스타일 1회 주입
  if (!document.getElementById('week-pager-style')){
    const css = `
      #weekOptions{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 12px;}
      #weekOptions .week-item{
        padding:6px 10px;border:1px solid var(--line,#e9e2d9);
        border-radius:999px;background:#fff;cursor:pointer;font-weight:600;
      }
      #weekOptions .week-item.selected{
        background:#111;color:#fff;border-color:#111;
      }
    `;
    const st = document.createElement('style');
    st.id = 'week-pager-style';
    st.textContent = css;
    document.head.appendChild(st);
  }

  weeks.forEach((days,i)=>{
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'week-item';
    item.textContent = `${i+1}주차`;
    item.addEventListener('click', ()=>{
      $$('.week-item', weekOptions).forEach(v=>v.classList.remove('selected'));
      item.classList.add('selected');

      // ✅ 선택 주 렌더 (월 경계 밖 날짜는 이미 없음)
      renderWeekGrid(days);

      // ✅ 헤더는 "그 달" 고정
      currentMonthYear.textContent = base.toLocaleString('ko-KR',{year:'numeric',month:'long'});

      // ✅ activeDate도 그 달 1일로 유지(월 이동 시 기준 유지)
      activeDate = new Date(base.getFullYear(), base.getMonth(), 1);
    });
    weekOptions.appendChild(item);
  });

  // 오늘이 속한 주 or 1주차 자동 선택
  const today = new Date();
  if (today.getFullYear() === base.getFullYear() && today.getMonth() === base.getMonth()){
    // 오늘 포함 주 인덱스 찾기
    let picked = false;
    weeks.forEach((days,i)=>{
      if (days.some(d=> d.toDateString() === today.toDateString())){
        weekOptions.children[i].click(); picked = true;
      }
    });
  }
  if (!picked && weeks.length) weekOptions.children[0].click();
}

// ✅ [NEW] 그 달 경계만 포함하는 주 배열(일~토로 끊되, 월 경계 밖 날짜는 제외)
function getWeeksOfMonthStrict(baseDate){
  const y = baseDate.getFullYear();
  const m = baseDate.getMonth();
  const daysIn = new Date(y, m + 1, 0).getDate();

  const weeks = [];
  let start = 1;
  while (start <= daysIn){
    const startDate = new Date(y, m, start);
    const firstDow  = startDate.getDay();          // 0(일)~6(토)
    const span      = Math.min(6 - firstDow + 1, daysIn - start + 1);
    const end       = start + span - 1;

    const days = [];
    for (let d = start; d <= end; d++) days.push(new Date(y, m, d));
    weeks.push(days);

    start = end + 1;
  }
  return weeks;  // 각 원소는 "해당 달 안"의 날짜만 포함
}




// === REPLACE: buildRestaurantList(date)
// === 월/주 셀 썸네일: 무카테고리 1줄 + 카테고리 1줄 ===
/* ===== 월/주 공용: 2줄 구조 렌더 (무카테고리 1줄, 카테고리 1줄) ===== */
function buildRestaurantList(date){
  const ev = load(date);
  const groups = { '': [], morning: [], lunch: [], dinner: [], cafe: [] };

  (ev.memos || []).forEach(m=>{
    const name = (m?.restaurantName || '').trim();
    if (!name) return;
    const cat = normalizeCategory(m.category || '');
    if (groups[cat]) groups[cat].push(name);
    else groups[''].push(name); // 방어
  });

  // 아무것도 없으면 null
  const hasAny = Object.values(groups).some(arr => arr.length > 0);
  if (!hasAny) return null;

  // 유틸: 칩 만들기
  const makeChip = (name, cat) => {
    const isUncat = !cat;
    const item  = document.createElement('div');
    item.className = 'dl-item' + (isUncat ? ' uncat' : '');

    if (!isUncat){
      const bar = document.createElement('span');
      bar.className = 'dl-bar-text';
      bar.dataset.cat = (cat === 'cafe') ? 'cafe' : 'meal';
      bar.textContent = '▌';
      item.appendChild(bar);
    }
    const label = document.createElement('span');
    label.className = 'dl-label' + (isUncat ? ' uncat-chip' : '');
    const arr = Array.from(name);
    label.textContent = arr.length > 3 ? arr.slice(0,3).join('') + '...' : name;
    item.appendChild(label);
    return item;
  };

  const wrap = document.createElement('div');
  wrap.className = 'day-list';

  // 1줄차: 무카테고리 전부
  if (groups[''].length){
    const rowU  = document.createElement('div'); rowU.className = 'dl-row';
    const boxU  = document.createElement('div'); boxU.className = 'dl-names';
    groups[''].forEach(n => boxU.appendChild(makeChip(n, '')));
    rowU.appendChild(boxU);
    wrap.appendChild(rowU);
  }

  // 2줄차: 카테고리(아침/점심/저녁/카페) 전부 합쳐서 한 줄
  const combined = ['morning','lunch','dinner','cafe']
    .flatMap(cat => groups[cat].map(n => ({ n, cat })));
  if (combined.length){
    const rowC  = document.createElement('div'); rowC.className = 'dl-row';
    const boxC  = document.createElement('div'); boxC.className = 'dl-names';
    combined.forEach(({n,cat}) => boxC.appendChild(makeChip(n, cat)));
    rowC.appendChild(boxC);
    wrap.appendChild(rowC);
  }

  return wrap;
}




// 추가: 기준 날짜가 속한 주의 7일 반환 (일~토)
function getWeekByDate(base){
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const start = new Date(d); start.setDate(d.getDate() - d.getDay()); // 일요일 시작
  return Array.from({length:7}, (_,i)=> new Date(start.getFullYear(), start.getMonth(), start.getDate()+i));
}

// 추가: "월 뷰와 동일한 DOM"으로 주만 7칸 렌더 (CSS 손대지 않음)
function renderWeekGrid(days){
  calendarGrid.innerHTML = '';

  ['일','월','화','수','목','금','토'].forEach(n=>{
    const el = document.createElement('div'); el.className='day-name'; el.textContent=n;
    calendarGrid.appendChild(el);
  });

  // ✅ 현재 달만 남기고, 7칸 정렬 유지 위해 패딩
  const m = activeDate.getMonth();
  const visible = days.filter(d => d.getMonth() === m);
  const padded  = [...visible];
  while (padded.length < 7) padded.push(null);   // 빈 칸으로 채우기

  padded.forEach(d=>{
    if (!d){
      const empty = document.createElement('div');  // 빈 칸
      calendarGrid.appendChild(empty);
      return;
    }
    const cell = document.createElement('div');
    cell.className = 'current-month';
    const num = document.createElement('div'); num.className = 'date-number'; num.textContent = String(d.getDate());
    cell.appendChild(num);

    if (d.toDateString() === new Date().toDateString()) cell.classList.add('today');

    const ev = load(d);
    const photoMemo = [...(ev.memos||[])].reverse().find(m=>m.photo);
    if (photoMemo?.photo) setDayPhoto(cell, photoMemo.photo);

    const namesEl = buildRestaurantList(d);
    if (namesEl) cell.appendChild(namesEl);

    on(cell,'click',()=>openModal(d));
    calendarGrid.appendChild(cell);
  });
}


// script.js — 로그인/회원가입/재설정 UI 제어 + 세션 가드 + 토스트
(function(){
  const $ = (s,p=document)=>p.querySelector(s);

  /* ---------- 토스트 ---------- */
  let toastEl = null, toastTimer = null;
  function toast(msg, type='ok'){
    if(!toastEl){
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.remove('ok','err'); toastEl.classList.add(type);
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=> toastEl.classList.remove('show'), 1800);
  }

  /* ---------- Hash 기반 뷰 전환 (login.html 전용) ---------- */
  function show(view){
    document.querySelectorAll('[data-view]').forEach(v=>{
      v.hidden = v.getAttribute('data-view') !== view;
    });
  }
  function route(){
    const h = (location.hash||'#login').slice(1);
    show(['login','signup','find'].includes(h) ? h : 'login');
  }
  window.addEventListener('hashchange', route);

  /* ---------- 폼 바인딩 (있는 페이지에서만 동작) ---------- */
  function bindAuthForms(){
    const loginForm = $('#loginForm');
    const signupForm = $('#signupForm');
    const findForm = $('#findForm');

    if(loginForm){
      route();
      loginForm.addEventListener('submit', (e)=>{
        e.preventDefault();
        const id = $('#liId').value.trim();
  const pw = $('#liPw').value.trim();
   const ok = window.auth.login(id, pw); // boolean 반환
   if (!ok) {
     toast('아이디 또는 비밀번호가 올바르지 않아요.', 'err');
     return;
   }
   toast('로그인 성공!');
   // 뒤로가기로 로그인 페이지 못 돌아오게 replace 권장
   setTimeout(()=> location.replace('index.html'), 200);
      });
    }

    if(signupForm){
      signupForm.addEventListener('submit', (e)=>{
        e.preventDefault();
        const realName = $('#suName').value.trim();
        const id = $('#suId').value.trim();
        const pw = $('#suPw').value.trim();
        const res = window.auth.signup({ id, password: pw, realName });
        if(!res.success) return toast(res.message||'회원가입 실패', 'err');
        toast('가입 완료! 로그인해주세요.');
        location.hash = '#login';
        // 입력값 정리
        signupForm.reset();
      });
    }

    if(findForm){
      findForm.addEventListener('submit', (e)=>{
        e.preventDefault();
        const id = $('#fpId').value.trim();
        const name = $('#fpName').value.trim();
        const npw = $('#fpNew').value.trim();
        const res = window.auth.resetPasswordByIdName({ id, realName:name, newPassword:npw });
        if(!res.success) return toast(res.message||'재설정 실패', 'err');
        toast('비밀번호를 변경했어요.');
        location.hash = '#login';
        findForm.reset();
      });
    }
  }

  /* ---------- 세션 가드 / 로그아웃 ---------- */
  function guard(){
    const path = location.pathname.split('/').pop();
    const profile = window.auth.getProfile();

    if(path === 'index.html' || path === ''){
      if(!profile){ location.href = 'login.html'; return; }
      // 로그아웃 버튼
      const btn = document.getElementById('logoutBtn');
      if(btn){
        btn.addEventListener('click', ()=>{
          window.auth.logout();
          toast('로그아웃했습니다.');
          setTimeout(()=> location.href = 'login.html', 300);
        });
      }
    }
    if(path === 'login.html' && profile){
      // 이미 로그인 상태면 메인으로
      location.href = 'index.html';
    }
  }

  /* ---------- 부팅 ---------- */
  document.addEventListener('DOMContentLoaded', ()=>{
    bindAuthForms();
    guard();
  });
})();




/* ===== Day(일) 뷰: 00:00~23:59 타임라인 + 실시간 파란선 ===== */
let _nowLineTimer = null;
function clearNowLineTimer(){ if(_nowLineTimer){ clearInterval(_nowLineTimer); _nowLineTimer=null; } }

function ensureGridCols(view){
  if (!calendarGrid) return;
  calendarGrid.style.display = 'grid';
  calendarGrid.style.gridGap = '10px'; // 기존 gap 유지(필요 없으면 지워도 됨)
  if (view === 'week'){
    // 헤더 7개 + 날짜 7개가 "가로 7칸"에 맞게
    calendarGrid.style.gridTemplateColumns = 'repeat(7, minmax(0, 1fr))';
    calendarGrid.style.gridAutoRows = 'minmax(120px, auto)'; // 카드 높이 기본값
  } else if (view === 'month'){
    // 월 뷰도 동일하게 보장(기존 CSS 있으면 그대로 동작)
    calendarGrid.style.gridTemplateColumns = 'repeat(7, minmax(0, 1fr))';
    calendarGrid.style.gridAutoRows = ''; // 월 CSS가 알아서
  }
}

function renderDayTimeline(){
  const d = dayViewDate instanceof Date ? dayViewDate : new Date();
  calendarGrid.innerHTML = '';

  // 스타일 1회 주입
  if (!document.getElementById('day-timeline-style')) {
    const css = `
      .dtl-wrap{display:flex;flex-direction:column;gap:14px;}
      .dtl-head{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border:1px solid var(--line,#e9e2d9);border-radius:10px;background:#fff;}
      .dtl-date{font-weight:800;}
      .dtl-body{position:relative;border:1px solid var(--line,#e9e2d9);border-radius:10px;background:#fff;overflow:hidden;}
      .dtl-grid{display:grid;grid-template-columns:64px 1fr;position:relative;}
      .dtl-hours{display:flex;flex-direction:column;}
      .dtl-slots{position:relative;}
      .dtl-hour{height:48px;display:flex;align-items:flex-start;justify-content:flex-end;padding:4px 8px;font-size:12px;color:#6b7280;border-top:1px dashed #eee;}
      .dtl-hour:first-child{border-top:none;}
      .dtl-slot{height:48px;border-top:1px dashed #f1f5f9;position:relative;}
      .dtl-slot:first-child{border-top:none;}
      .now-line{position:absolute;left:64px;right:0;height:2px;background:#2563eb;box-shadow:0 0 0 1px rgba(37,99,235,.2);z-index:2;}
      .now-dot{position:absolute;width:8px;height:8px;border-radius:999px;background:#2563eb;left:60px;transform:translate(-50%,-50%);z-index:3;}
      .task{position:absolute;left:8px;right:8px;min-height:32px;padding:6px 8px;border:1px solid #e5e7eb;border-radius:10px;background:#f8fafc;display:flex;align-items:center;gap:8px}
      .task .time{font-size:12px;padding:2px 6px;border:1px solid #e5e7eb;border-radius:999px;background:#fff;}
      .task.completed{opacity:.6;text-decoration:line-through;}
      .task-non{margin:12px;border:1px dashed #e5e7eb;border-radius:10px;padding:8px 10px;background:#fafafa;}
      .dtl-sec{border:1px solid var(--line,#e9e2d9);border-radius:10px;background:#fff;padding:10px 12px;}
      .dtl-memo-list{display:flex;flex-direction:column;gap:8px;}
      .dtl-memo-item{display:flex;gap:8px;align-items:center;}
      .dtl-chip{font-size:12px;padding:2px 6px;border:1px solid #e5e7eb;border-radius:999px;background:#f8fafc;white-space:nowrap;}
      .dtl-foot{display:flex;justify-content:flex-end;gap:8px;}
      .btn{border:1px solid var(--line,#e9e2d9);background:#fff;border-radius:10px;padding:8px 12px;cursor:pointer;}
      .btn.primary{background:#111;color:#fff;border-color:#111;}
    `;
    const st = document.createElement('style');
    st.id = 'day-timeline-style';
    st.textContent = css;
    document.head.appendChild(st);
  }

  const wrap = document.createElement('div');
  wrap.className = 'dtl-wrap';

  // 헤더
 // --- 헤더 (수정 후: 버튼 제거) ---
const head = document.createElement('div');
head.className = 'dtl-head';

const names = ['일','월','화','수','목','금','토'];
const y = d.getFullYear(), m = d.getMonth()+1, day = d.getDate(), wd = names[d.getDay()];

const left = document.createElement('div');
left.className = 'dtl-date';
left.innerHTML = `<strong>${y}</strong>.${String(m).padStart(2,'0')}.${String(day).padStart(2,'0')} (${wd})`;

// 버튼 없이 날짜만 헤더에 추가
head.appendChild(left);

wrap.appendChild(head);


  // 데이터
  const { memos=[], todos=[] } = load(d);

  // 메모 섹션(간단)
  const memoSec = document.createElement('section');
  memoSec.className = 'dtl-sec';
  const memoTitle = document.createElement('h4'); memoTitle.textContent = '메모(맛집)'; memoTitle.style.margin='0 0 8px 0';
  memoSec.appendChild(memoTitle);
  if (!memos.length){
    const empty=document.createElement('div'); empty.className='muted'; empty.textContent='등록된 메모가 없습니다.'; memoSec.appendChild(empty);
  } else {
    const order={morning:0, lunch:1, dinner:2, cafe:3, '':4};
    const list = document.createElement('div'); list.className='dtl-memo-list';
    memos
      .map((m,i)=>({...m,_i:i,category:normalizeCategory(m.category||'')}))
      .sort((a,b)=>(order[a.category]??99)-(order[b.category]??99) || (a._i-b._i))
      .forEach(m=>{
        const row = document.createElement('div'); row.className='dtl-memo-item';
        const chip= document.createElement('span'); chip.className='dtl-chip'; chip.textContent=(CATEGORY_LABELS[m.category]||'무');
        const title=document.createElement('strong'); title.textContent=(m.restaurantName||'(이름 없음)');
        const text =document.createElement('span'); text.className='muted'; text.textContent=(m.memoText||'').trim()||'—';
        row.append(chip,title,text);
        list.appendChild(row);
      });
    memoSec.appendChild(list);
  }
  wrap.appendChild(memoSec);

  // 타임라인 영역
  const body = document.createElement('div');
  body.className = 'dtl-body';
  const grid = document.createElement('div');
  grid.className = 'dtl-grid';

  const hoursCol = document.createElement('div'); hoursCol.className='dtl-hours';
  const slotsCol = document.createElement('div'); slotsCol.className='dtl-slots';

  for (let h=0; h<24; h++){
    const hh = String(h).padStart(2,'0');
    const hourEl = document.createElement('div'); hourEl.className='dtl-hour'; hourEl.textContent = `${hh}:00`;
    hoursCol.appendChild(hourEl);

    const slotEl = document.createElement('div'); slotEl.className='dtl-slot'; slotEl.dataset.hh = hh;
    slotsCol.appendChild(slotEl);
  }

  grid.append(hoursCol, slotsCol);
  body.appendChild(grid);
  wrap.appendChild(body);

  // 할 일 배치 (시간 있는 항목만 타임라인, 없는 건 아래 박스)
  const parseTimeToMinutes = (t)=>{
    if (!t) return null;
    const [hh,mm] = String(t).split(':').map(v=>parseInt(v,10));
    if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
    return hh*60+mm;
  };
  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  const withTime = [], noTime = [];
  todos.forEach((t, _i)=>{
    const mins = parseTimeToMinutes(t.time);
    if (mins===null) noTime.push({...t,_i}); else withTime.push({...t,_i,mins});
  });
  // 시간순, 미완료 우선
  withTime.sort((a,b)=>{
    if (!!a.completed !== !!b.completed) return a.completed?1:-1;
    if (a.mins!==b.mins) return a.mins-b.mins;
    return String(a.text||'').localeCompare(String(b.text||''));
  });

  // 슬롯 높이(px) = 48, 분->px 환산 = 48/60
  const pxPerMin = 48/60;
  withTime.forEach(t=>{
    // 분 단위 절대 위치 = (시*60 + 분) * pxPerMin
const offsetPx = t.mins * pxPerMin;

const task = document.createElement('div');
task.className = 'task' + (t.completed?' completed':'');
task.style.top = `${offsetPx}px`;   // ← offsetTop 의존 제거
task.style.left = '8px';
task.style.right = '8px';
task.innerHTML = `<span class="time">${t.time}</span><span class="txt">${t.text||''}</span>`;
slotsCol.appendChild(task);

  });

  if (noTime.length){
    const non = document.createElement('div');
    non.className = 'task-non';
    non.innerHTML = `<strong>시간 미지정</strong>`;
    const ul = document.createElement('ul'); ul.style.margin='6px 0 0 16px';
    // 미완료 우선
    noTime.sort((a,b)=> (!!a.completed!==!!b.completed) ? (a.completed?1:-1) : String(a.text||'').localeCompare(String(b.text||'')));
    noTime.forEach(t=>{
      const li=document.createElement('li');
      li.textContent = (t.text||'') + (t.completed?' (완료)':'');
      ul.appendChild(li);
    });
    non.appendChild(ul);
    wrap.appendChild(non);
  }

  // 실시간 파란선(now-line)
  function placeNowLine(){
    const today = new Date();
    const sameDay = today.toDateString() === d.toDateString();
    let nowLine = body.querySelector('.now-line');
    let nowDot  = body.querySelector('.now-dot');

    if (!sameDay){
      // 오늘이 아니면 제거
      if (nowLine) nowLine.remove();
      if (nowDot)  nowDot.remove();
      return;
    }

    if (!nowLine){ nowLine = document.createElement('div'); nowLine.className='now-line'; body.appendChild(nowLine); }
    if (!nowDot ){ nowDot  = document.createElement('div'); nowDot.className='now-dot';  body.appendChild(nowDot ); }

    const minutes = today.getHours()*60 + today.getMinutes();
    const yPx = minutes * pxPerMin; // 상단으로부터 px
    const gridTop = grid.getBoundingClientRect().top + window.scrollY;
    const bodyTop = body.getBoundingClientRect().top + window.scrollY;

    // now-line은 slotsCol 내부 상대가 아니라 body 기준으로 절대 배치
    // dtl-body 내부 top=0 기준으로 yPx 배치하려면, 0시 기준이 slotsCol 상단과 일치하므로 그대로 사용
    nowLine.style.top = `${yPx}px`;
    nowDot.style.top  = `${yPx}px`;
  }

  placeNowLine();
  clearNowLineTimer();
  _nowLineTimer = setInterval(placeNowLine, 30 * 1000); // 30초마다 업데이트

  // 푸터
  const foot = document.createElement('div');
  foot.className = 'dtl-foot';
  const openBtn = document.createElement('button'); openBtn.type='button'; openBtn.className='btn'; openBtn.textContent='이 날 상세 보기';
  openBtn.addEventListener('click', ()=> openModal(d));
  foot.appendChild(openBtn);
  wrap.appendChild(foot);

  calendarGrid.appendChild(wrap);
}

/* ===== 메인 렌더 ===== */
function renderCalendar(){
  if (!calendarGrid) return;
  calendarGrid.innerHTML='';
  weekOptions && (weekOptions.innerHTML='');

  // 상단 월 표기
  if (currentView === 'day'){
    const yy = dayViewDate.getFullYear().toString().slice(2);
    const mm = String(dayViewDate.getMonth()+1).padStart(2,'0');
    currentMonthYear.textContent = `${yy}년 ${mm}월`;
  } else {
    currentMonthYear.textContent = activeDate.toLocaleString('ko-KR', { year:'numeric', month:'long' });
  }

  const y=activeDate.getFullYear(), m=activeDate.getMonth();
  const firstDow=new Date(y,m,1).getDay();
  const daysIn =new Date(y,m+1,0).getDate();

  if (currentView!=='day'){
    ['일','월','화','수','목','금','토'].forEach(n=>{
      const d=document.createElement('div'); d.className='day-name'; d.textContent=n; calendarGrid.appendChild(d);
    });
    for(let i=0;i<firstDow;i++) calendarGrid.appendChild(document.createElement('div'));
  }

  if(currentView==='month' || currentView==='week'){
    for(let day=1; day<=daysIn; day++){
      const cell=document.createElement('div'); cell.className='current-month';
      const num=document.createElement('div'); num.className='date-number'; num.textContent=String(day);
      cell.appendChild(num);

      const d=new Date(y,m,day);
      if(d.toDateString()===new Date().toDateString()) cell.classList.add('today');

      const ev = load(d);
      const photoMemo = [...(ev.memos || [])].reverse().find(m => m.photo);
      if (photoMemo?.photo) setDayPhoto(cell, photoMemo.photo);

      const namesEl = buildRestaurantList(d);
      if (namesEl) cell.appendChild(namesEl);

      on(cell,'click',()=>openModal(d));
      calendarGrid.appendChild(cell);
    }
  }

  if(currentView==='month'){
    calendarGrid.style.display='grid';
    weekOptions.style.display='none';
  } // 기존 renderCalendar() 내부의 주(week) 분기 부분을 아래로 교체
else if (currentView === 'week') {
  // 주차 선택 바 보이기
  if (weekOptions) {
    weekOptions.style.display = 'flex';
  }
  // 주차 버튼(1주차~N주차) 다시 그리기
  renderWeekList();
}


  else if(currentView==='day'){
    calendarGrid.style.display='block';
    weekOptions.style.display='block';
    renderDayTimeline();
  } else {
    calendarGrid.style.display='none';
    weekOptions.style.display='none';
  }
}

/* ===== 네비/뷰 전환 ===== */

on(monthViewBtn,'click', ()=>{
  currentView='month';
  monthViewBtn.classList.add('active');
  weekViewBtn.classList.remove('active');
  highlightViewBtn.classList.remove('active');
  clearNowLineTimer();
  renderCalendar(); // ✅ activeDate 그대로 (원래 기능 보존)
});

/* 여기를 교체 */
weekViewBtn.onclick = ()=>{
  currentView = 'week';
  monthViewBtn?.classList.remove('active');
  weekViewBtn?.classList.add('active');
  highlightViewBtn?.classList.remove('active');
  clearNowLineTimer();
  renderCalendar(); // 스타일 건드리지 않음
};



on(highlightViewBtn,'click',()=>{ // 일
  currentView='day';
  monthViewBtn?.classList.remove('active'); weekViewBtn?.classList.remove('active'); highlightViewBtn?.classList.add('active');
  const t=new Date();
  dayViewDate = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  activeDate  = new Date(dayViewDate.getFullYear(), dayViewDate.getMonth(), 1);
  renderCalendar();
});
on(todayBtn,'click',()=>{
  const t=new Date();
  activeDate  = new Date(t.getFullYear(), t.getMonth(), 1);
  dayViewDate = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  renderCalendar();
});

// 이전 버튼
prevMonthBtn.onclick = ()=>{
  if (currentView === 'week') {
    activeDate.setMonth(activeDate.getMonth() - 1);   // ✅ 월 이동
  } else if (currentView === 'day') {
    dayViewDate.setDate(dayViewDate.getDate() - 1);
    activeDate = new Date(dayViewDate.getFullYear(), dayViewDate.getMonth(), 1);
  } else {
    activeDate.setMonth(activeDate.getMonth() - 1);
  }
  renderCalendar();
};

nextMonthBtn.onclick = ()=>{
  if (currentView === 'week') {
    activeDate.setMonth(activeDate.getMonth() + 1);   // ✅ 월 이동
  } else if (currentView === 'day') {
    dayViewDate.setDate(dayViewDate.getDate() + 1);
    activeDate = new Date(dayViewDate.getFullYear(), dayViewDate.getMonth(), 1);
  } else {
    activeDate.setMonth(activeDate.getMonth() + 1);
  }
  renderCalendar();
};



/* ===== QuickTodoBar 복원(월/주 상단 바) ===== */
(function restoreQuickTodoBar(){
  function ensureQuickTodoBarMount(){
    const controls = document.querySelector('.calendar-controls');
    if (!controls) return null;
    let bar = document.getElementById('quickTodoBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'quickTodoBar';
      bar.style.marginTop = '8px';
      bar.style.padding = '8px 10px';
      bar.style.border = '1px solid var(--line,#e9e2d9)';
      bar.style.borderRadius = '10px';
      bar.style.background = '#fff';
      controls.insertAdjacentElement('afterend', bar);
    }
    return bar;
  }

  (function injectQTBCSS(){
    if (document.getElementById('planeat-qtb-style')) return;
    const css = `
      #quickTodoBar{ display:block; }
      #quickTodoBar .qt-row-wrap{ display:flex; align-items:flex-start; gap:12px; }
      #quickTodoBar .qt-left{ flex:1; display:flex; flex-direction:column; gap:8px; min-width:0; }
      #quickTodoBar .qt-right{ display:flex; align-items:center; }
      #quickTodoBar .qt-plus{ border:1px solid var(--line,#e9e2d9); background:#fafafa; border-radius:10px; padding:8px 12px; cursor:pointer; }
      #quickTodoBar .qt-row{ display:flex; align-items:center; gap:10px; padding:8px 10px; border:1px solid var(--line,#eee); border-radius:10px; background:#fff; }
      #quickTodoBar .qt-bullet{ font-weight:800; }
      #quickTodoBar .qt-meta{ display:flex; gap:6px; align-items:center; }
      #quickTodoBar .qt-dday{ font-weight:800; font-size:12px; padding:2px 6px; border-radius:999px; border:1px solid #e5e7eb; background:#f8fafc; }
      #quickTodoBar .qt-dday.is-today{ border-color:#d7e7ff; background:#eef6ff; color:#1e3a8a; }
      #quickTodoBar .qt-date{ font-size:12px; color:#666; }
      #quickTodoBar .qt-input{ flex:1; min-width:0; border:1px solid #eee; border-radius:8px; padding:8px 10px; background:#fff; }
      #quickTodoBar .qt-icons{ display:flex; gap:6px; }
      #quickTodoBar .qt-icon{ border:1px solid #e5e5e5; background:#fff; border-radius:8px; padding:6px 8px; cursor:pointer; }
      #quickTodoBar .quick-todo-empty{ color:#888; }
    `;
    const tag = document.createElement('style');
    tag.id = 'planeat-qtb-style';
    tag.textContent = css;
    document.head.appendChild(tag);
  })();

  if (!window.genUid) {
    window.genUid = function genUid(){
      return 'm' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    };
  }
  if (!window.ymdToDate) {
    window.ymdToDate = function ymdToDate(s){
      if(!s) return null;
      const [y,m,d] = s.split('-').map(n=>parseInt(n,10));
      if(!y || !m || !d) return null;
      return new Date(y, m-1, d);
    };
  }
  if (!window.calcDday) {
    window.calcDday = function calcDday(dateStr){
      if(!dateStr) return null;
      const [y,m,d] = dateStr.split('-').map(n=>parseInt(n,10));
      if(!y || !m || !d) return null;
      const today = new Date(); today.setHours(0,0,0,0);
      const tgt   = new Date(y, m-1, d); tgt.setHours(0,0,0,0);
      const diff  = Math.round((tgt - today) / (1000*60*60*24));
      if(diff === 0) return { label:'D-DAY', today:true };
      return { label: diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`, today:false };
    };
  }
  if (!window.getMonthKey) {
    window.getMonthKey = function getMonthKey(){
      const base = window.activeDate instanceof Date ? window.activeDate : new Date();
      return `monthTodos-${base.getFullYear()}-${String(base.getMonth()+1).padStart(2,'0')}`;
    };
  }
  if (!window.migrateMonthTodos) {
    window.migrateMonthTodos = function migrateMonthTodos(raw){
      if (Array.isArray(raw)) {
        return raw.map(x => {
          if (typeof x === 'string') {
            return { id: genUid(), text: x, date: '' };
          }
          return {
            id: (x && x.id) ? x.id : genUid(),
            text: (x && x.text) ? x.text : '',
            date: (x && x.date) ? x.date : ''
          };
        });
      }
      return [];
    };
  }
  if (!window.saveMonthTodos) {
    window.saveMonthTodos = function saveMonthTodos(list){
      const safe = Array.isArray(list)
        ? list.map(it => ({
            id: it.id || genUid(),
            text: String(it.text || ''),
            date: String(it.date || '')
          }))
        : [];
      localStorage.setItem(getMonthKey(), JSON.stringify(safe));
    };
  }
  if (!window.loadMonthTodos) {
    window.loadMonthTodos = function loadMonthTodos(){
      const raw = JSON.parse(localStorage.getItem(getMonthKey())) || [];
      return migrateMonthTodos(raw);
    };
  }
  if (!window.removeDayTodoMirror) {
    window.removeDayTodoMirror = function removeDayTodoMirror(uid, ymd){
      const d = ymdToDate(ymd);
      if(!d || !window.load || !window.save) return;
      const data = load(d);
      data.todos = (data.todos||[]).filter(t => t.srcMonthUid !== uid);
      save(d, data);
    };
  }
  if (!window.upsertDayTodoFromMonth) {
    window.upsertDayTodoFromMonth = function upsertDayTodoFromMonth(item){
      if(!item || !item.date || !window.load || !window.save) return;
      const dateObj = ymdToDate(item.date);
      if(!dateObj) return;

      const data = load(dateObj);
      data.todos = Array.isArray(data.todos) ? data.todos : [];

      const normText = (item.text || '(제목 없음)').trim();
      const uid = item.id;

      let idx = data.todos.findIndex(t => t && t.srcMonthUid === uid);
      if(idx === -1){
        idx = data.todos.findIndex(t =>
          t && !t.srcMonthUid && String(t.text||'').trim() === normText
        );
        if(idx !== -1){
          data.todos[idx].srcMonthUid = uid;
        }
      }
      if(idx === -1){
        data.todos.push({
          text: normText,
          time: '',
          completed: false,
          srcMonthUid: uid
        });
      }else{
        data.todos[idx].text = normText;
      }
      save(dateObj, data);
      const keep = [];
      const seen = new Set();
      data.todos.forEach((t)=>{
        const key = t?.srcMonthUid ? `uid:${t.srcMonthUid}` : `txt:${String(t?.text||'').trim()}`;
        if(seen.has(key)) return;
        seen.add(key);
        keep.push(t);
      });
      if(keep.length !== data.todos.length){
        data.todos = keep;
        save(dateObj, data);
      }
    };
  }

  if (!window.renderQuickTodoBar) {
    window.renderQuickTodoBar = function renderQuickTodoBar(){
      const bar = ensureQuickTodoBarMount();
      if (!bar) return;

      const cv = (window.currentView || 'month');
      if (cv === 'month' || cv === 'week') {
        bar.style.display = 'block';
      } else {
        bar.style.display = 'none';
        return;
      }

      let monthTodoList = loadMonthTodos();
      bar.innerHTML = '';

      const wrap = document.createElement('div');
      wrap.className = 'qt-row-wrap';

      const left = document.createElement('div');
      left.className = 'qt-left';

      if (!monthTodoList.length){
        const empty = document.createElement('div');
        empty.className = 'quick-todo-empty';
        empty.textContent = '이번 달 계획';
        left.appendChild(empty);
      } else {
        monthTodoList.forEach((itemRaw, idx)=>{
          const item = (typeof itemRaw === 'string')
            ? { id: genUid(), text: itemRaw, date: '' }
            : { id: itemRaw.id || genUid(), text: (itemRaw.text||''), date: (itemRaw.date||'') };

          if (!itemRaw.id) {
            monthTodoList[idx] = item;
            saveMonthTodos(monthTodoList);
          }

          const line = document.createElement('div');
          line.className = 'qt-row';

          const bullet = document.createElement('span');
          bullet.className = 'qt-bullet';
          bullet.textContent = '･';

          const meta = document.createElement('div');
          meta.className = 'qt-meta';

          const ddaySpan = document.createElement('span');
          ddaySpan.className = 'qt-dday';
          const dd = calcDday(item.date);
          if (dd) {
            ddaySpan.textContent = dd.label;
            if (dd.today) ddaySpan.classList.add('is-today');
          } else {
            ddaySpan.textContent = 'D-—';
          }

          const dateBadge = document.createElement('span');
          dateBadge.className = 'qt-date';
          dateBadge.textContent = item.date || '날짜 미지정';

          meta.append(ddaySpan, dateBadge);

          const input = document.createElement('input');
          input.className = 'qt-input';
          input.placeholder = '이번 달 할 일';
          input.value = item.text;
          input.readOnly = true;
          input.addEventListener('input', ()=>{
            monthTodoList[idx] = { ...item, text: input.value };
            saveMonthTodos(monthTodoList);
            if (item.date) upsertDayTodoFromMonth(monthTodoList[idx]);
          });
          input.addEventListener('blur', ()=>{ input.readOnly = true; });

          const icons = document.createElement('div');
          icons.className = 'qt-icons';

          const calBtn = document.createElement('button');
          calBtn.type = 'button';
          calBtn.className = 'qt-icon';
          calBtn.title = '날짜 설정';
          calBtn.textContent = '📅';

          const dateInput = document.createElement('input');
          dateInput.type = 'date';
          dateInput.value = item.date || '';
          dateInput.style.display = 'none';
          dateInput.addEventListener('change', ()=>{
            const prevDate = item.date || '';
            const nextDate = dateInput.value || '';

            item.date = nextDate;
            monthTodoList[idx] = { ...item };
            saveMonthTodos(monthTodoList);

            dateBadge.textContent = nextDate || '날짜 미지정';
            const d = calcDday(nextDate);
            if (d) {
              ddaySpan.textContent = d.label;
              ddaySpan.classList.toggle('is-today', !!d.today);
            } else {
              ddaySpan.textContent = 'D-—';
              ddaySpan.classList.remove('is-today');
            }

            if (prevDate && prevDate !== nextDate) {
              removeDayTodoMirror(item.id, prevDate);
            }
            if (nextDate) {
              upsertDayTodoFromMonth(item);
            }
            dateInput.style.display = 'none';
          });

          calBtn.addEventListener('click', (e)=>{
            e.stopPropagation();
            document.querySelectorAll('#quickTodoBar .qt-row input[type="date"]').forEach(el=>{
              if(el !== dateInput) el.style.display = 'none';
            });
            dateInput.style.display = (dateInput.style.display === 'none') ? '' : 'none';
            if (dateInput.style.display !== 'none') dateInput.focus();
          });

          const editBtn = document.createElement('button');
          editBtn.type = 'button';
          editBtn.className = 'qt-icon';
          editBtn.title = '편집';
          editBtn.textContent = '✏️';
          editBtn.addEventListener('click', ()=>{
            input.readOnly = !input.readOnly;
            if(!input.readOnly){
              input.focus();
              const v = input.value; input.value = ''; input.value = v;
            }
          });

          const delBtn = document.createElement('button');
          delBtn.type = 'button';
          delBtn.className = 'qt-icon';
          delBtn.title = '삭제';
          delBtn.textContent = '🗑️';
          delBtn.addEventListener('click', ()=>{
            if (item.date) removeDayTodoMirror(item.id, item.date);
            monthTodoList.splice(idx,1);
            saveMonthTodos(monthTodoList);
            renderQuickTodoBar();
          });

          icons.append(calBtn, editBtn, delBtn);

          line.append(bullet, meta, input, icons, dateInput);
          left.appendChild(line);
        });

      }

      const right = document.createElement('div');
      right.className = 'qt-right';
      const plus = document.createElement('button');
      plus.className = 'qt-plus';
      plus.textContent = '+';
      plus.addEventListener('click', ()=>{
        monthTodoList.push({ id: genUid(), text:'', date:'' });
        saveMonthTodos(monthTodoList);
        renderQuickTodoBar();
        const rows = document.querySelectorAll('#quickTodoBar .qt-row');
        const lastRow = rows[rows.length - 1];
        if (lastRow) {
          const input = lastRow.querySelector('.qt-input');
          if (input) {
            input.readOnly = false;
            input.focus();
            const val = input.value; input.value = ''; input.value = val;
          }
        }
      });
      right.appendChild(plus);

      wrap.append(left, right);
      bar.appendChild(wrap);
    };
  }

  const _rc = window.renderCalendar;
  window.renderCalendar = function patchedRenderCalendar(){
    if (typeof _rc === 'function') _rc.apply(this, arguments);
    ensureQuickTodoBarMount();
    window.renderQuickTodoBar && window.renderQuickTodoBar();
  };

  ensureQuickTodoBarMount();
  window.renderQuickTodoBar && window.renderQuickTodoBar();
})();

/* ===== 부팅 ===== */
(function boot(){
  refreshAllRestaurants();
  mountSearchInline();
  (async function initAlarmScheduler(){
    await ensureNotificationPermission();
  })();

  // ===============================
// ✅ 칩 자동 축소 (셀 넘칠 때만)
// ===============================
function autoScaleDayLists(){
  const cells = document.querySelectorAll('.calendar-grid .day-cell');
  cells.forEach(cell=>{
    const list = cell.querySelector('.day-list');
    if(!list) return;

    list.style.transform = '';
    list.style.transformOrigin = 'top left';

    const maxH = cell.clientHeight - 24; // 여백 감안
    const curH = list.scrollHeight;

    if(curH > maxH){
      const scale = maxH / curH;
      list.style.transform = `scale(${scale})`;
    }
  });
}


  renderCalendar();
})();

// ✅ 칩 자동 축소 (셀 넘칠 때만) — 단일 정의만 유지
function autoScaleDayLists(){
  const cells = document.querySelectorAll('#calendarGrid .current-month'); // ← 셀렉터 교체
  cells.forEach(cell=>{
    const list = cell.querySelector('.day-list');
    if(!list) return;

    list.style.transform = '';
    list.style.transformOrigin = 'top left';

    const style = getComputedStyle(cell);
    const padV  = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const maxH  = cell.clientHeight - padV - 6; // 여백 약간 감안
    const curH  = list.scrollHeight;

    if(curH > maxH){
      const scale = Math.max(0.65, maxH / curH); // 너무 작아지지 않게 하한
      list.style.transform = `scale(${scale})`;
    }
  });
}

// 📌 달력 렌더 이후 자동 실행 (+ 이미지 로드 후도 재계산)
const _renderCalendarOrig = renderCalendar;
renderCalendar = function(y,m){
  _renderCalendarOrig(y,m);
  // 이미지 로딩에 따른 높이 변동 보정
  setTimeout(autoScaleDayLists, 0);
  const imgs = document.querySelectorAll('#calendarGrid img');
  imgs.forEach(img=>{
    if(img.complete) return;
    img.addEventListener('load', ()=> setTimeout(autoScaleDayLists,0), {once:true});
  });
};

/* =========================
   Bucket List (장기 목표 보관함)
   - localStorage key: 'planeat-bucket'
   - 기한 없음/장기 목표를 저장
   - 월간 계획(quickTodoBar)으로 보내기, 완료 체크, 편집/삭제
   - 드래그 정렬
   ========================= */

/* 저장/불러오기 */
function bucketKey(){ return 'planeat-bucket'; }
function bucketLoad(){
  try { return JSON.parse(localStorage.getItem(bucketKey())) || []; }
  catch { return []; }
}
function bucketSave(list){
  const safe = Array.isArray(list) ? list.map(x=>({
    id: x.id || ('b'+Math.random().toString(36).slice(2)+Date.now().toString(36)),
    text: String(x.text||''),
    done: !!x.done,
    star: !!x.star,
    tag: String(x.tag||'')   // 카테고리/태그(선택)
  })) : [];
  localStorage.setItem(bucketKey(), JSON.stringify(safe));
}

/* 월간 계획으로 보내기 (quickTodoBar 연동) */
function bucketSendToMonth(item){
  if (!item || !window.loadMonthTodos || !window.saveMonthTodos) return;
  const list = window.loadMonthTodos();
  list.push({ id: window.genUid ? window.genUid() : ('m'+Date.now()), text: item.text, date: '' });
  window.saveMonthTodos(list);
  // 양방향 미러링은 월간 계획 쪽 로직이 처리함
  window.renderQuickTodoBar && window.renderQuickTodoBar();
  // 안내 토스트(가벼운 피드백)
  bucketToast('월간 계획으로 보냈어요.');
}

/* 스타일 1회 주입 */
(function bucketInjectStyle(){
  if (document.getElementById('bucket-style')) return;
  const css = `
  #bucketPanel{ margin-top:10px; }
  .bucket-wrap{
    border:1px solid var(--line,#e9e2d9); background:#fff; border-radius:10px; padding:10px 12px;
  }
  .bucket-head{ display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px; }
  .bucket-title{ font-weight:800; }
  .bucket-add{ display:flex; gap:8px; }
  .bucket-input{ flex:1; min-width:0; border:1px solid #eee; border-radius:8px; padding:8px 10px; }
  .bucket-tag{ width:100px; border:1px solid #eee; border-radius:8px; padding:8px 10px; }
  .bucket-btn{ border:1px solid var(--line,#e9e2d9); background:#fafafa; border-radius:8px; padding:8px 10px; cursor:pointer; }
  .bucket-list{ display:flex; flex-direction:column; gap:8px; }
  .bucket-item{
    display:flex; align-items:center; gap:10px; padding:8px 10px; border:1px solid var(--line,#eee);
    border-radius:10px; background:#fff; user-select:none;
  }
  .bucket-item.dragging{ opacity:.6; }
  .bucket-text{ flex:1; min-width:0; }
  .bucket-text.done{ text-decoration:line-through; color:#9aa0a6; }
  .bucket-chip{ font-size:12px; padding:2px 6px; border:1px solid #e5e7eb; border-radius:999px; background:#f8fafc; white-space:nowrap; }
  .bucket-actions{ display:flex; gap:6px; }
  .bucket-icon{ border:1px solid #e5e5e5; background:#fff; border-radius:8px; padding:6px 8px; cursor:pointer; }
  .bucket-star.on{ color:#eab308; border-color:#f1e3a1; background:#fffceb; }
  .bucket-empty{ color:#888; padding:4px 0 2px; }
  .bucket-toast{
    position:fixed; left:50%; transform:translateX(-50%);
    bottom:20px; padding:10px 14px; border-radius:999px; background:#111; color:#fff; font-size:13px;
    box-shadow:0 10px 24px rgba(0,0,0,.15); z-index:99999; opacity:0; transition:opacity .2s ease;
  }
  .bucket-toast.show{ opacity:1; }
  `;
  const st = document.createElement('style');
  st.id = 'bucket-style'; st.textContent = css;
  document.head.appendChild(st);
})();

/* 토스트 */
let bucketToastTimer=null;
function bucketToast(msg){
  let el = document.getElementById('bucket-toast');
  if(!el){ el = document.createElement('div'); el.id='bucket-toast'; el.className='bucket-toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(bucketToastTimer);
  bucketToastTimer = setTimeout(()=> el.classList.remove('show'), 1300);
}

/* 렌더 */
function renderBucketPanel(){
  // mount
  let mount = document.getElementById('bucketPanel');
  if(!mount){
    // calendar-controls 아래로 자동 삽입
    const controls = document.querySelector('.calendar-controls');
    mount = document.createElement('div');
    mount.id = 'bucketPanel';
    if (controls) controls.insertAdjacentElement('afterend', mount);
    else document.body.appendChild(mount);
  }
  mount.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'bucket-wrap';

  // 헤더 + 입력
  const head = document.createElement('div'); head.className='bucket-head';
  const title = document.createElement('div'); title.className='bucket-title'; title.textContent='버킷리스트';

  const add = document.createElement('div'); add.className='bucket-add';
  const input = document.createElement('input'); input.className='bucket-input'; input.placeholder='장기 목표를 입력하세요';
  const tag   = document.createElement('input'); tag.className='bucket-tag'; tag.placeholder='태그(선택)';
  const btn   = document.createElement('button'); btn.type='button'; btn.className='bucket-btn'; btn.textContent='추가';

  function doAdd(){
    const text = (input.value||'').trim();
    if(!text) return;
    const list = bucketLoad();
    list.push({ id:'b'+Math.random().toString(36).slice(2)+Date.now().toString(36), text, tag: (tag.value||'').trim(), done:false, star:false });
    bucketSave(list);
    input.value=''; tag.value='';
    renderBucketPanel();
  }
  btn.addEventListener('click', doAdd);
  input.addEventListener('keydown', e=>{ if(e.key==='Enter') doAdd(); });

  add.append(input, tag, btn);
  head.append(title, add);

  // 목록
  const listEl = document.createElement('div'); listEl.className='bucket-list';
  let list = bucketLoad();

  // 별표 우선 → 미완료 우선 → 텍스트
  list.sort((a,b)=>{
    if (!!b.star !== !!a.star) return b.star ? 1 : -1;
    if (!!a.done !== !!b.done) return a.done ? 1 : -1;
    return String(a.text||'').localeCompare(String(b.text||''));
  });

  if(!list.length){
    const empty = document.createElement('div'); empty.className='bucket-empty'; empty.textContent='아직 항목이 없어요. 위 입력창에 추가해보세요.';
    listEl.appendChild(empty);
  }else{
    // 드래그 정렬 지원
    let dragIdx = -1;
    function commitOrder(){
      const items = [...listEl.querySelectorAll('.bucket-item')];
      const newList = [];
      items.forEach(it=>{
        const id = it.dataset.id;
        const found = list.find(x=>x.id===id);
        if(found) newList.push(found);
      });
      bucketSave(newList);
      list = newList;
    }

    list.forEach((item, idx)=>{
      const row = document.createElement('div');
      row.className = 'bucket-item';
      row.draggable = true;
      row.dataset.id = item.id;

      // 드래그
      row.addEventListener('dragstart', ()=>{ dragIdx = idx; row.classList.add('dragging'); });
      row.addEventListener('dragend', ()=>{ dragIdx = -1; row.classList.remove('dragging'); commitOrder(); });
      row.addEventListener('dragover', (e)=>{
        e.preventDefault();
        const after = e.clientY < row.getBoundingClientRect().top + row.offsetHeight/2;
        const dragging = listEl.querySelector('.bucket-item.dragging');
        if(!dragging || dragging===row) return;
        if(after) listEl.insertBefore(dragging, row);
        else listEl.insertBefore(dragging, row.nextSibling);
      });

      // 체크
      const cb = document.createElement('input'); cb.type='checkbox'; cb.checked=!!item.done;
      cb.addEventListener('change', ()=>{
        item.done = cb.checked;
        bucketSave(list); renderBucketPanel();
      });

      // 텍스트(인라인 편집)
      const span = document.createElement('span'); span.className='bucket-text' + (item.done?' done':''); span.textContent=item.text;
      span.title = item.text;
      span.addEventListener('dblclick', ()=>{
        const ip = document.createElement('input'); ip.className='bucket-input'; ip.value=item.text;
        ip.addEventListener('keydown', e=>{
          if(e.key==='Enter'){ item.text=ip.value.trim(); bucketSave(list); renderBucketPanel(); }
          if(e.key==='Escape'){ renderBucketPanel(); }
        });
        ip.addEventListener('blur', ()=>{ item.text=ip.value.trim(); bucketSave(list); renderBucketPanel(); });
        row.replaceChild(ip, span); ip.focus(); ip.select();
      });

      // 태그
      const chip = document.createElement('span');
      chip.className = 'bucket-chip';
      chip.textContent = item.tag ? ('#'+item.tag) : '무태그';
      chip.addEventListener('click', ()=>{
        const ip = document.createElement('input'); ip.className='bucket-tag'; ip.value=item.tag||'';
        ip.addEventListener('keydown', e=>{
          if(e.key==='Enter'){ item.tag = ip.value.trim(); bucketSave(list); renderBucketPanel(); }
          if(e.key==='Escape'){ renderBucketPanel(); }
        });
        ip.addEventListener('blur', ()=>{ item.tag = ip.value.trim(); bucketSave(list); renderBucketPanel(); });
        row.replaceChild(ip, chip); ip.focus(); ip.select();
      });

      // 액션들
      const acts = document.createElement('div'); acts.className='bucket-actions';

      const star = document.createElement('button'); star.type='button'; star.className='bucket-icon bucket-star' + (item.star?' on':'' ); star.textContent='★';
      star.title='중요 표시';
      star.addEventListener('click', ()=>{ item.star=!item.star; bucketSave(list); renderBucketPanel(); });

      const send = document.createElement('button'); send.type='button'; send.className='bucket-icon'; send.textContent='→월';
      send.title='월간 계획으로 보내기';
      send.addEventListener('click', ()=> bucketSendToMonth(item));

      const del = document.createElement('button'); del.type='button'; del.className='bucket-icon'; del.textContent='🗑︎';
      del.title='삭제';
      del.addEventListener('click', ()=>{
        if(!confirm('이 버킷 항목을 삭제할까요?')) return;
        const rest = list.filter(x=>x.id!==item.id);
        bucketSave(rest); renderBucketPanel();
      });

      acts.append(star, send, del);

      row.append(cb, span, chip, acts);
      listEl.appendChild(row);
    });
  }

  wrap.append(head, listEl);
  mount.appendChild(wrap);
}

/* 뷰 전환과의 연동:
   - month / week 에서 보여주고
   - day 뷰에서는 숨겨 UX 집중
*/
(function bucketPatchRender(){
  const _rc = window.renderCalendar;
  window.renderCalendar = function patched(){
    _rc && _rc.apply(this, arguments);

    // mount & render
    renderBucketPanel();

    // 뷰별 표시/숨김
    const panel = document.getElementById('bucketPanel');
    if(!panel) return;
    if (window.currentView === 'day') {
      panel.style.display = 'none';
    } else {
      panel.style.display = 'block';
    }
  };
})();
