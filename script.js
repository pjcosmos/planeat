/* =========================
   script.js  (FULL REPLACEMENT)
   - 기존 기능 유지 / 충돌 정리
   - 검색 UI 인라인 고정(돋보기 옆)
   - DAY 뷰 = 00:00~23:59 타임라인 + 실시간 파란선(now-line)
   - 썸네일 대표 선택: 전역 캡처 위임
   ========================= */

/* ===== 알림 환경 진단 ===== */
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
  return Notification.permission;
}

/* ===== 공통 유틸 ===== */
const $  = (s,p=document)=>p.querySelector(s);
const $$ = (s,p=document)=>Array.from(p.querySelectorAll(s));
const on = (el,ev,fn)=>el && el.addEventListener(ev,fn);
const SHOW_WEEK_PHOTO = false;

/* ===== 날짜 키/저장 ===== */
function keyOf(d){
  const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return dd.toDateString();
}
function load(d){
  try { return JSON.parse(localStorage.getItem(keyOf(d))) || { memos:[], todos:[] }; }
  catch { return { memos:[], todos:[] }; }
}
function save(d, data){
  localStorage.setItem(keyOf(d), JSON.stringify(data||{memos:[],todos:[]}));
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

/* ===== 아이콘 ===== */
const ICONS = {
  edit:  `<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>`,
  trash: `<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a 1 1 0 0 1 1 1v2"/></svg>`,
  photo:`<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 15l-5-5-7 7"/></svg>`
};
const CATEGORY_LABELS = { morning:'아침', lunch:'점심', dinner:'저녁', cafe:'카페' };

/* ===== 검색 인덱싱 ===== */
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

/* ===== 검색 UI(인라인) ===== */
const SEARCH_MIN_CHARS = 1;
function renderSearchList(q = '') {
  const resultsBox = document.getElementById('searchResults');
  if (!resultsBox) return;
  const query = String(q || '').trim();
  if (query.length < SEARCH_MIN_CHARS) { resultsBox.innerHTML = ''; return; }
  resultsBox.innerHTML = '';
  const rows = (ALL_RESTAURANTS && ALL_RESTAURANTS.length) ? ALL_RESTAURANTS : collectAllRestaurants();
  const filtered = rows.filter(r => r.name.toLowerCase().includes(query.toLowerCase()));
  if (!filtered.length){
    const empty = document.createElement('div');
    empty.className = 'muted'; empty.style.padding = '10px';
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
    input.type = 'text';
    input.placeholder = '식당명 검색…';
  }
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('autocorrect', 'off');
  input.setAttribute('autocapitalize', 'off');
  input.setAttribute('spellcheck', 'false');
  input.setAttribute('name', 'planeat_search_' + Math.random().toString(36).slice(2));
  input.setAttribute('data-lpignore', 'true');
  input.setAttribute('data-form-type', 'other');
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
  btn.onclick = (e) => {
    e.stopPropagation();
    const q = (input.value || '').trim();
    const isClosed = panel.getAttribute('aria-hidden') !== 'false';
    if (isClosed) {
      if (q.length >= SEARCH_MIN_CHARS) { openSearchPanel(); renderSearchList(q); }
      input.focus();
    } else closeSearchPanel();
  };
  input.addEventListener('focus', (e)=>{ e.stopPropagation(); openSearchPanel(); });
  input.addEventListener('input', ()=> renderSearchList(input.value) );
  document.removeEventListener('click', window.__searchOutsideHandler || (()=>{}));
  window.__searchOutsideHandler = (e)=>{
    if (panel.getAttribute('aria-hidden')==='true') return;
    const inside = e.target.closest('.search-inputbox') || e.target.closest('#searchBtn');
    if (!inside) closeSearchPanel();
  };
  document.addEventListener('click', window.__searchOutsideHandler);
}
function refreshSearchAfterDataChange() {
  refreshAllRestaurants();
  const panel = document.getElementById('searchPanel');
  const input = document.getElementById('searchInput');
  if (!panel || !input) return;
  const q = (input.value || '').trim();
  const isOpen = panel.getAttribute('aria-hidden') === 'false';
  if (isOpen && q.length >= SEARCH_MIN_CHARS) renderSearchList(q);
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
let calendarGrid = document.getElementById('calendarGrid') || document.querySelector('.calendar-grid');
if (!calendarGrid) {
  calendarGrid = document.createElement('div');
  calendarGrid.id = 'calendarGrid';
  calendarGrid.className = 'calendar-grid';
  (document.querySelector('.calendar') || document.body).appendChild(calendarGrid);
}
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
const memoForm      = $('#memoForm');
const categoryWrap  = $('.memo-categories');
const restaurantNameInput = $('#restaurantName');
const photoUploadInput    = $('#photoUpload');
const memoTextInput       = $('#memoText');
const addMemoBtn          = $('#addMemoBtn');
const photoIconBtn        = $('#photoIconBtn');
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
  if (typeof closeSearchPanel === 'function') closeSearchPanel();
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
if (!document.getElementById('modal-z-fix')) {
  const st = document.createElement('style');
  st.id = 'modal-z-fix';
  st.textContent = `
    #eventModal { z-index: 100000 !important; }
    body.modal-open #searchPanel { display: none !important; pointer-events: none !important; }
  `;
  document.head.appendChild(st);
}

/* ===== 썸네일 이미지 투명 방지 ===== */
if (!document.getElementById('photo-opacity-lock')) {
  const tag = document.createElement('style');
  tag.id = 'photo-opacity-lock';
  tag.textContent = `
    .day-bg-img, .day-bg-underlay {
      opacity: 1 !important;
      filter: none !important;
      mix-blend-mode: normal !important;
      image-rendering: auto !important;
    }
  `;
  document.head.appendChild(tag);
}
/* 썸네일 컨테이너 스타일 */
if (!document.getElementById('thumbs-fix-style')) {
  const st = document.createElement('style');
  st.id = 'thumbs-fix-style';
  st.textContent = `
    #photoThumbs { display:flex; flex-wrap:wrap; gap:6px; position:relative; z-index:1; }
    #photoThumbs .thumb-choice { position:relative; z-index:2; pointer-events:auto; }
  `;
  document.head.appendChild(st);
}

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
        refreshSearchAfterDataChange();
        renderSaved(); renderCalendar();
      });

      if (!isEditing) {
        const title = document.createElement('h5');
        const cat = m.category;
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

        // 여러 장 커버 선택
        const row2 = document.createElement('div'); 
        row2.className = 'inline-row grid-2';
        let tempPhotos = Array.isArray(m.photos) ? m.photos.slice() : (m.photo ? [m.photo] : []);
        let tempCover  = Math.max(0, m.coverIdx || 0);
        const left = document.createElement('div');
        const thumbs = document.createElement('div');
        thumbs.style.display = 'flex'; thumbs.style.gap = '6px'; thumbs.style.flexWrap = 'wrap';
        function drawThumbs(){
          thumbs.innerHTML = '';
          if (!tempPhotos.length){ thumbs.innerHTML = '<div class="muted">사진 없음</div>'; return; }
          tempPhotos.forEach((src, i) => {
            const b = document.createElement('div');
            b.style.cssText = `position:relative;width:56px;height:56px;border-radius:10px;overflow:hidden;border:2px solid ${i===tempCover ? '#111':'#e5e7eb'};display:flex;align-items:center;justify-content:center;`;
            const im = document.createElement('img'); im.src = src; im.alt = `p${i+1}`; im.style.cssText = 'width:100%;height:100%;object-fit:cover;';
            const star = document.createElement('span');
            star.textContent = i===tempCover ? '★' : '☆';
            star.style.cssText = `position:absolute;right:3px;top:3px;background:#fff;border:1px solid #e5e7eb;border-radius:999px;padding:0 3px;font-size:12px;line-height:1.1;`;
            const del = document.createElement('button');
            del.type = 'button'; del.setAttribute('aria-label','사진 삭제'); del.textContent = '×';
            del.style.cssText = `position:absolute;left:3px;top:3px;width:18px;height:18px;border-radius:999px;border:1px solid #e5e7eb;background:#fff;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;line-height:1;`;
            del.addEventListener('click', (e)=>{
              e.stopPropagation();
              tempPhotos.splice(i, 1);
              if (tempPhotos.length === 0) tempCover = 0;
              else if (i === tempCover) tempCover = Math.max(0, Math.min(tempCover - 1, tempPhotos.length - 1));
              else if (i < tempCover) tempCover = Math.max(0, tempCover - 1);
              drawThumbs();
            });
            b.addEventListener('click', ()=>{ tempCover=i; drawThumbs(); });
            b.append(im, star, del);
            thumbs.appendChild(b);
          });
        }
        drawThumbs();
        left.appendChild(thumbs);
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
          item.photo          = item.photos[item.coverIdx] || '';
          save(selectedDate, data);
          refreshSearchAfterDataChange();
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
  const files = Array.from(e.target.files || []).slice(0, 12);
  memoPhotos = [];
  coverIdx = 0;
  const readers = files.map(f => new Promise((res) => {
    const r = new FileReader();
    r.onload = ev => res(ev.target.result);
    r.readAsDataURL(f);
  }));
  memoPhotos = await Promise.all(readers);
  renderThumbChooser();
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
    item.dataset.idx = String(idx);   
    item.style.cssText = `position:relative;width:64px;height:64px;border-radius:10px;overflow:hidden;border:2px solid ${idx===coverIdx ? '#111' : '#e5e7eb'};`;
    const img = document.createElement('img');
    img.src = src; img.alt = `photo ${idx+1}`;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
    const badge = document.createElement('span');
    badge.textContent = idx===coverIdx ? '★' : '☆';
    badge.style.cssText = `position:absolute;right:4px;top:4px;font-size:14px;background:#fff;border-radius:999px;padding:0 4px;line-height:1.2;border:1px solid #e5e7eb;`;
    item.append(img, badge);
    box.appendChild(item);
  });
}
/* 썸네일 클릭 전역 위임(캡처) */
if (!window.__thumbDelegated) {
  window.__thumbDelegated = true;
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.thumb-choice');
    if (!btn) return;
    const holder = btn.closest('#photoThumbs');
    if (!holder) return;
    e.preventDefault();
    e.stopPropagation();
    const idx = parseInt(btn.dataset.idx, 10);
    if (!Number.isNaN(idx)) {
      coverIdx = idx;
      renderThumbChooser();
    }
  }, true);
}
on(photoIconBtn,'click',()=>{ photoUploadInput && photoUploadInput.click(); });
function aid() { return 'a' + Math.random().toString(36).slice(2) + Date.now().toString(36); }
on(addMemoBtn,'click',()=>{
  if(!selectedDate) return;
  const name = (restaurantNameInput?.value||'').trim();
  const memoText = (memoTextInput?.value||'').trim();
  if(!name && !memoText && memoPhotos.length===0){ alert('메모, 식당 이름 또는 사진 중 하나는 입력해주세요.'); return; }
  const data = load(selectedDate);
  const photos = memoPhotos.slice();
  data.memos.push({
    category: normalizeCategory(selectedCategory),
    restaurantName: name,
    memoText,
    photo: photos[coverIdx] || '',
    photos,
    coverIdx: Math.max(0, Math.min(coverIdx, photos.length-1)),
    ts: Date.now()
  });
  save(selectedDate, data);
  refreshSearchAfterDataChange();
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
  refreshSearchAfterDataChange();
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

/* ===== 주/월 유틸 ===== */
function setDayPhoto(cellEl, src){
  cellEl.classList.add('has-photo');
  let under = cellEl.querySelector('.day-bg-underlay');
  let main  = cellEl.querySelector('.day-bg-img');
  if (!under) { under = document.createElement('img'); under.className = 'day-bg-underlay'; cellEl.prepend(under); }
  if (!main)  { main  = document.createElement('img'); main .className = 'day-bg-img';      cellEl.prepend(main ); }
  ['opacity','filter','mixBlendMode'].forEach(k=>{ under.style[k]=''; main.style[k]=''; });
  under.src = src; main.src  = src;
}
function buildRestaurantList(date){
  const ev = load(date);
  const groups = { '': [], morning: [], lunch: [], dinner: [], cafe: [] };
  (ev.memos || []).forEach(m=>{
    const name = (m?.restaurantName || '').trim();
    if (!name) return;
    const cat = normalizeCategory(m.category || '');
    if (groups[cat]) groups[cat].push(name);
    else groups[''].push(name);
  });
  const hasAny = Object.values(groups).some(arr => arr.length > 0);
  if (!hasAny) return null;
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
  if (groups[''].length){
    const rowU  = document.createElement('div'); rowU.className = 'dl-row';
    const boxU  = document.createElement('div'); boxU.className = 'dl-names';
    groups[''].forEach(n => boxU.appendChild(makeChip(n, '')));
    rowU.appendChild(boxU);
    wrap.appendChild(rowU);
  }
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
function getWeeksOfMonthStrict(baseDate){
  const y = baseDate.getFullYear();
  const m = baseDate.getMonth();
  const daysIn = new Date(y, m + 1, 0).getDate();
  const weeks = [];
  let start = 1;
  while (start <= daysIn){
    const startDate = new Date(y, m, start);
    const firstDow  = startDate.getDay();
    const span      = Math.min(6 - firstDow + 1, daysIn - start + 1);
    const end       = start + span - 1;
    const days = [];
    for (let d = start; d <= end; d++) days.push(new Date(y, m, d));
    weeks.push(days);
    start = end + 1;
  }
  return weeks;
}
function renderWeekGrid(days){
  calendarGrid.innerHTML = '';
  calendarGrid.style.display = 'block';
  calendarGrid.style.gridTemplateColumns = '';
  weekOptions && (weekOptions.style.display = 'flex');
  if(!document.getElementById('week-list-style')){
    const css = `
      .week-list{ display:flex; flex-direction:column; gap:10px; }
      .week-day-card{ border:1px solid var(--line,#e9e2d9); border-radius:12px; background:#fff; padding:10px 12px; }
      .week-day-head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
      .week-day-title{ font-weight:800; }
      .week-day-meta{ font-size:12px; color:#6b7280; display:flex; gap:8px; align-items:center; }
      .week-day-photo{ width:100%; max-height:180px; border-radius:10px; object-fit:cover; display:block; margin:6px 0 8px 0; }
      .week-names{ margin-top:4px; }
      .week-empty{ color:#9aa0a6; font-size:13px; }
      .week-todo-list{ display:flex; flex-direction:column; gap:4px; margin-top:6px; }
      .week-todo-item{ display:flex; align-items:center; gap:6px; font-size:14px; }
      .week-todo-time{ font-size:12px; padding:2px 6px; border:1px solid #e5e7eb; border-radius:999px; background:#f8fafc; }
      .week-actions{ display:flex; gap:8px; justify-content:flex-end; margin-top:8px; }
      .btn{ border:1px solid var(--line,#e9e2d9); background:#fff; border-radius:10px; padding:6px 10px; cursor:pointer; }
      .btn.primary{ background:#111; color:#fff; border-color:#111; }
      .today-badge{ font-size:11px; padding:2px 6px; border-radius:999px; border:1px solid #d7e7ff; background:#eef6ff; color:#1e3a8a; }
    `;
    const st = document.createElement('style'); st.id='week-list-style'; st.textContent=css; document.head.appendChild(st);
  }
  const weekday = ['일','월','화','수','목','금','토'];
  const list = document.createElement('div'); list.className = 'week-list';
  const monthIdx = activeDate.getMonth();
  const onlyThisMonth = days.filter(d => d.getMonth() === monthIdx);
  onlyThisMonth.forEach(d=>{
    const card = document.createElement('div'); card.className = 'week-day-card';
    const head = document.createElement('div'); head.className = 'week-day-head';
    const y = d.getFullYear(), m = d.getMonth()+1, day = d.getDate();
    const title = document.createElement('div'); title.className='week-day-title';
    title.textContent = `${String(m).padStart(2,'0')}.${String(day).padStart(2,'0')} (${weekday[d.getDay()]})`;
    const meta = document.createElement('div'); meta.className = 'week-day-meta';
    if (d.toDateString() === new Date().toDateString()){
      const badge = document.createElement('span'); badge.className = 'today-badge'; badge.textContent = '오늘'; meta.appendChild(badge);
    }
    head.append(title, meta); card.appendChild(head);
    const ev = load(d);
    if (SHOW_WEEK_PHOTO) {
      const photoMemo = [...(ev.memos || [])].reverse().find(m => m.photo);
      if (photoMemo?.photo){
        const img = document.createElement('img'); img.className='week-day-photo'; img.src = photoMemo.photo; img.alt = '대표 사진';
        card.appendChild(img);
      }
    }
    const namesEl = buildRestaurantList(d);
    if (namesEl){
      const wrap = document.createElement('div'); wrap.className = 'week-names'; wrap.appendChild(namesEl);
      card.appendChild(wrap);
    } else {
      const empty = document.createElement('div'); empty.className = 'week-empty'; empty.textContent = '등록된 메모가 없어요.';
      card.appendChild(empty);
    }
    const todos = (ev.todos || []).slice();
    const parseTime = (t)=>{ if(!t) return null; const [hh,mm] = String(t).split(':').map(x=>parseInt(x,10)); return (isNaN(hh)||isNaN(mm)) ? null : (hh*60+mm); };
    todos.sort((a,b)=>{
      const am = parseTime(a.time), bm = parseTime(b.time);
      if (am===null && bm!==null) return 1;
      if (am!==null && bm===null) return -1;
      if (am!==bm) return (am||0)-(bm||0);
      if (!!a.completed !== !!b.completed) return a.completed?1:-1;
      return String(a.text||'').localeCompare(String(b.text||''));
    });
    if (todos.length){
      const tlist = document.createElement('div'); tlist.className = 'week-todo-list';
      todos.forEach(t=>{
        const row = document.createElement('div'); row.className = 'week-todo-item';
        if (t.time){ const tb = document.createElement('span'); tb.className='week-todo-time'; tb.textContent=t.time; row.appendChild(tb); }
        const label = document.createElement('span'); label.textContent = (t.text||'') + (t.completed?' (완료)':'');
        row.appendChild(label); tlist.appendChild(row);
      });
      card.appendChild(tlist);
    }
    const acts = document.createElement('div'); acts.className = 'week-actions';
    const openBtn = document.createElement('button'); openBtn.type='button'; openBtn.className='btn'; openBtn.textContent='이 날 상세';
    openBtn.addEventListener('click', ()=> openModal(d));
    acts.appendChild(openBtn); card.appendChild(acts);
    list.appendChild(card);
  });
  calendarGrid.appendChild(list);
}
function renderWeekList(){
  if (!weekOptions) return;
  weekOptions.innerHTML = '';
  const base = new Date(activeDate.getFullYear(), activeDate.getMonth(), 1);
  const weeks = getWeeksOfMonthStrict(base);
  if (!document.getElementById('week-pager-style')){
    const css = `
      #weekOptions{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 12px;}
      #weekOptions .week-item{ padding:6px 10px;border:1px solid var(--line,#e9e2d9); border-radius:999px;background:#fff;cursor:pointer;font-weight:600; }
      #weekOptions .week-item.selected{ background:#111;color:#fff;border-color:#111; }
    `;
    const st = document.createElement('style'); st.id='week-pager-style'; st.textContent=css; document.head.appendChild(st);
  }
  weeks.forEach((days,i)=>{
    const item = document.createElement('button');
    item.type = 'button'; item.className = 'week-item';
    item.textContent = `${i+1}주차`;
    item.addEventListener('click', ()=>{
      $$('.week-item', weekOptions).forEach(v=>v.classList.remove('selected'));
      item.classList.add('selected');
      renderWeekGrid(days);
      currentMonthYear.textContent = base.toLocaleString('ko-KR',{year:'numeric',month:'long'});
      activeDate = new Date(base.getFullYear(), base.getMonth(), 1);
    });
    weekOptions.appendChild(item);
  });
  let picked = false;
  const today = new Date();
  if (today.getFullYear() === base.getFullYear() && today.getMonth() === base.getMonth()){
    weeks.forEach((days,i)=>{
      if (days.some(d=> d.toDateString() === today.toDateString())){
        weekOptions.children[i].click(); picked = true;
      }
    });
  }
  if (!picked && weeks.length) weekOptions.children[0].click();
}

/* ===== Mini Month(월 선택) ===== */
let miniMonthEl = null;
let miniMonthBase = null;
function openMiniMonth(baseDate){
  if (!miniMonthEl) buildMiniMonth();
  miniMonthBase = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  renderMiniMonthGrid();
  miniMonthEl.removeAttribute('aria-hidden');
}
function closeMiniMonth(){
  if (!miniMonthEl) return;
  miniMonthEl.setAttribute('aria-hidden','true');
}
function buildMiniMonth(){
  miniMonthEl = document.createElement('div');
  miniMonthEl.id = 'miniMonth';
  miniMonthEl.setAttribute('aria-hidden','true');
  miniMonthEl.innerHTML = `
    <div class="mm-window" role="dialog" aria-label="월 선택">
      <div class="mm-head">
        <button type="button" class="mm-prev" aria-label="이전 달">◀</button>
        <div class="mm-title"></div>
        <button type="button" class="mm-next" aria-label="다음 달">▶</button>
        <button type="button" class="mm-close">닫기</button>
      </div>
      <div class="mm-body">
        <div class="mm-grid"></div>
      </div>
    </div>
  `;
  document.body.appendChild(miniMonthEl);
  miniMonthEl.querySelector('.mm-prev').addEventListener('click', ()=>{
    miniMonthBase.setMonth(miniMonthBase.getMonth()-1);
    renderMiniMonthGrid();
  });
  miniMonthEl.querySelector('.mm-next').addEventListener('click', ()=>{
    miniMonthBase.setMonth(miniMonthBase.getMonth()+1);
    renderMiniMonthGrid();
  });
  miniMonthEl.querySelector('.mm-close').addEventListener('click', closeMiniMonth);
}
function renderMiniMonthGrid(){
  if (!miniMonthEl) return;
  const title = miniMonthEl.querySelector('.mm-title');
  const grid  = miniMonthEl.querySelector('.mm-grid');
  const y = miniMonthBase.getFullYear();
  const m = miniMonthBase.getMonth();
  title.textContent = `${y}년 ${m+1}월`;
  const names = ['일','월','화','수','목','금','토'];
  grid.innerHTML = '';
  names.forEach(n=>{
    const h = document.createElement('div');
    h.className='mm-dow';
    h.textContent=n;
    grid.appendChild(h);
  });
  const firstDow = new Date(y,m,1).getDay();
  const daysIn   = new Date(y,m+1,0).getDate();
  for(let i=0;i<firstDow;i++){ const pad = document.createElement('div'); pad.className='mm-pad'; grid.appendChild(pad); }
  for(let d=1; d<=daysIn; d++){
    const cell = document.createElement('button');
    cell.type='button'; cell.className='mm-day'; cell.textContent = d;
    const thisDate = new Date(y,m,d);
    const isToday = thisDate.toDateString() === new Date().toDateString();
    const isSelected = dayViewDate && thisDate.toDateString() === dayViewDate.toDateString();
    if (isToday) cell.classList.add('is-today');
    if (isSelected) cell.classList.add('is-selected');
    cell.addEventListener('click', ()=>{
      dayViewDate = new Date(y,m,d);
      activeDate  = new Date(y,m,1);
      renderCalendar();
      renderMiniMonthGrid();
    });
    grid.appendChild(cell);
  }
}
if (!document.getElementById('mini-month-style')) {
  const st = document.createElement('style');
  st.id = 'mini-month-style';
  st.textContent = `
    #miniMonth[aria-hidden="true"]{display:none;}
    #miniMonth{position:fixed;inset:0;z-index:99999;pointer-events:none;}
    #miniMonth .mm-window{
      pointer-events:auto;position:absolute;left:50%;top:14vh;transform:translateX(-50%);
      width:min(560px,92vw);max-height:72vh;background:#fff;border:1px solid var(--line,#e9e2d9);
      border-radius:16px;box-shadow:0 18px 44px rgba(0,0,0,.14);display:flex;flex-direction:column;overflow:hidden;
    }
    .mm-head{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--line,#eee);background:linear-gradient(#fff,#fafafa);}
    .mm-title{flex:1;text-align:center;font-weight:800;}
    .mm-prev,.mm-next,.mm-close{border:1px solid var(--line,#e9e2d9);background:#fff;border-radius:10px;padding:6px 10px;cursor:pointer;}
    .mm-body{padding:10px 12px;overflow:auto;}
    .mm-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;}
    .mm-dow{text-align:center;font-size:12px;color:#6b7280;padding:4px 0;}
    .mm-pad{height:0;}
    .mm-day{border:1px solid #eee;background:#fff;border-radius:10px;padding:8px 0;cursor:pointer;font-weight:600;}
    .mm-day.is-today{outline:2px solid #dbeafe;}
    .mm-day.is-selected{border-color:#111;box-shadow:0 0 0 2px #111 inset;}
  `;
  document.head.appendChild(st);
}

/* ===== Day 타임라인 ===== */
let _nowLineTimer = null;
function clearNowLineTimer(){ if(_nowLineTimer){ clearInterval(_nowLineTimer); _nowLineTimer=null; } }
function renderDayTimeline(){
  const d = dayViewDate instanceof Date ? dayViewDate : new Date();
  calendarGrid.innerHTML = '';
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
    const st = document.createElement('style'); st.id='day-timeline-style'; st.textContent=css; document.head.appendChild(st);
  }
  const wrap = document.createElement('div'); wrap.className = 'dtl-wrap';
  const head = document.createElement('div'); head.className = 'dtl-head';
  const names = ['일','월','화','수','목','금','토'];
  const y = d.getFullYear(), m = d.getMonth()+1, day = d.getDate(), wd = names[d.getDay()];
  const left = document.createElement('div'); left.className = 'dtl-date';
  left.innerHTML = `<strong>${y}</strong>.${String(m).padStart(2,'0')}.${String(day).padStart(2,'0')} (${wd})`;
  const right = document.createElement('div'); right.className = 'dtl-head-right';
  const monthBtn = document.createElement('button'); monthBtn.type = 'button'; monthBtn.className = 'btn month-mini-open'; monthBtn.textContent = 'month';
  monthBtn.addEventListener('click', ()=> openMiniMonth(d));
  right.appendChild(monthBtn);
  head.append(left, right); wrap.appendChild(head);

  const { memos=[], todos=[] } = load(d);
  const memoSec = document.createElement('section'); memoSec.className = 'dtl-sec';
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

  const body = document.createElement('div'); body.className = 'dtl-body';
  const grid = document.createElement('div'); grid.className = 'dtl-grid';
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
  slotsCol.style.position = 'relative';
  slotsCol.style.height   = String(48 * 24) + 'px';
  grid.style.position     = 'relative';

  const parseTimeToMinutes = (t)=>{
    if (!t) return null;
    const [hh,mm] = String(t).split(':').map(v=>parseInt(v,10));
    if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
    return hh*60+mm;
  };
  const withTime = [], noTime = [];
  todos.forEach((t, _i)=>{
    const mins = parseTimeToMinutes(t.time);
    if (mins===null) noTime.push({...t,_i}); else withTime.push({...t,_i,mins});
  });
  withTime.sort((a,b)=>{
    if (!!a.completed !== !!b.completed) return a.completed?1:-1;
    if (a.mins!==b.mins) return a.mins-b.mins;
    return String(a.text||'').localeCompare(String(b.text||''));
  });
  const pxPerMin = 48/60;
  withTime.forEach(t=>{
    const offsetPx = t.mins * pxPerMin;
    const task = document.createElement('div');
    task.className = 'task' + (t.completed?' completed':'');
    task.style.top = `${offsetPx}px`;
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
    noTime.sort((a,b)=> (!!a.completed!==!!b.completed) ? (a.completed?1:-1) : String(a.text||'').localeCompare(String(b.text||'')));
    noTime.forEach(t=>{
      const li=document.createElement('li');
      li.textContent = (t.text||'') + (t.completed?' (완료)':'');
      ul.appendChild(li);
    });
    non.appendChild(ul);
    wrap.appendChild(non);
  }

  function placeNowLine(){
    const today = new Date();
    const sameDay = today.toDateString() === d.toDateString();
    let nowLine = body.querySelector('.now-line');
    let nowDot  = body.querySelector('.now-dot');
    if (!sameDay){
      if (nowLine) nowLine.remove();
      if (nowDot)  nowDot.remove();
      return;
    }
    if (!nowLine){ nowLine = document.createElement('div'); nowLine.className='now-line'; body.appendChild(nowLine); }
    if (!nowDot ){ nowDot  = document.createElement('div'); nowDot.className='now-dot';  body.appendChild(nowDot ); }
    const minutes = today.getHours()*60 + today.getMinutes();
    const yPx = minutes * pxPerMin;
    nowLine.style.top = `${yPx}px`;
    nowDot.style.top  = `${yPx}px`;
  }
  placeNowLine();
  clearNowLineTimer();
  _nowLineTimer = setInterval(placeNowLine, 30 * 1000);

  const foot = document.createElement('div'); foot.className = 'dtl-foot';
  const openBtn = document.createElement('button'); openBtn.type='button'; openBtn.className='btn'; openBtn.textContent='이 날 상세 보기';
  openBtn.addEventListener('click', ()=> openModal(d));
  foot.appendChild(openBtn); wrap.appendChild(foot);
  calendarGrid.appendChild(wrap);
}

/* ===== 캘린더 렌더 ===== */
function autoScaleDayLists(){
  const cells = document.querySelectorAll('#calendarGrid .current-month');
  cells.forEach(cell=>{
    const list = cell.querySelector('.day-list');
    if(!list) return;
    list.style.transform = '';
    list.style.transformOrigin = 'top left';
    const style = getComputedStyle(cell);
    const padV  = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const maxH  = cell.clientHeight - padV - 6;
    const curH  = list.scrollHeight;
    if(curH > maxH){
      const scale = Math.max(0.65, maxH / curH);
      list.style.transform = `scale(${scale})`;
    }
  });
}
function renderCalendar(){
  if (!calendarGrid) return;
  calendarGrid.innerHTML='';
  weekOptions && (weekOptions.innerHTML='');

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

  if (currentView === 'month') {
    const names = ['일','월','화','수','목','금','토'];
    names.forEach(n=>{
      const d=document.createElement('div');
      d.className='day-name';
      d.textContent=n;
      calendarGrid.appendChild(d);
    });
    for(let i=0;i<firstDow;i++) calendarGrid.appendChild(document.createElement('div'));
    for(let day=1; day<=daysIn; day++){
      const cell = document.createElement('div');
      cell.className = 'current-month day-cell';
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
    calendarGrid.style.display='grid';
    weekOptions && (weekOptions.style.display='none');
  }
  else if (currentView === 'week') {
    calendarGrid.style.display = 'block';
    weekOptions && (weekOptions.style.display = 'flex');
    renderWeekList();
  }
  else if (currentView === 'day') {
    calendarGrid.style.display='block';
    weekOptions && (weekOptions.style.display='block');
    renderDayTimeline();
  }
  else {
    calendarGrid.style.display='none';
    weekOptions && (weekOptions.style.display='none');
  }

  calendarGrid.classList.toggle('is-month', currentView === 'month');
  calendarGrid.classList.toggle('is-week',  currentView === 'week');
  calendarGrid.classList.toggle('is-day',   currentView === 'day');

  setTimeout(autoScaleDayLists, 0);
  const imgs = document.querySelectorAll('#calendarGrid img');
  imgs.forEach(img=>{
    if(img.complete) return;
    img.addEventListener('load', ()=> setTimeout(autoScaleDayLists,0), {once:true});
  });
}

/* ===== 네비/뷰 전환 ===== */
on(monthViewBtn,'click', ()=>{
  currentView='month';
  monthViewBtn?.classList.add('active');
  weekViewBtn?.classList.remove('active');
  highlightViewBtn?.classList.remove('active');
  clearNowLineTimer();
  renderCalendar();
});
on(weekViewBtn,'click', ()=>{
  currentView = 'week';
  monthViewBtn?.classList.remove('active');
  weekViewBtn?.classList.add('active');
  highlightViewBtn?.classList.remove('active');
  clearNowLineTimer();
  renderCalendar();
});
on(highlightViewBtn,'click',()=>{
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
on(prevMonthBtn,'click', ()=>{
  if (currentView === 'week') {
    activeDate.setMonth(activeDate.getMonth() - 1);
  } else if (currentView === 'day') {
    dayViewDate.setDate(dayViewDate.getDate() - 1);
    activeDate = new Date(dayViewDate.getFullYear(), dayViewDate.getMonth(), 1);
  } else {
    activeDate.setMonth(activeDate.getMonth() - 1);
  }
  renderCalendar();
});
on(nextMonthBtn,'click', ()=>{
  if (currentView === 'week') {
    activeDate.setMonth(activeDate.getMonth() + 1);
  } else if (currentView === 'day') {
    dayViewDate.setDate(dayViewDate.getDate() + 1);
    activeDate = new Date(dayViewDate.getFullYear(), dayViewDate.getMonth(), 1);
  } else {
    activeDate.setMonth(activeDate.getMonth() + 1);
  }
  renderCalendar();
});

/* ===== QuickTodoBar (월간 계획) ===== */
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
    const tag = document.createElement('style'); tag.id = 'planeat-qtb-style'; tag.textContent = css; document.head.appendChild(tag);
  })();
  if (!window.genUid) window.genUid = function genUid(){ return 'm' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); };
  if (!window.ymdToDate) window.ymdToDate = function ymdToDate(s){ if(!s) return null; const [y,m,d] = s.split('-').map(n=>parseInt(n,10)); if(!y || !m || !d) return null; return new Date(y, m-1, d); };
  if (!window.calcDday) window.calcDday = function calcDday(dateStr){
    if(!dateStr) return null;
    const [y,m,d] = dateStr.split('-').map(n=>parseInt(n,10));
    if(!y || !m || !d) return null;
    const today = new Date(); today.setHours(0,0,0,0);
    const tgt   = new Date(y, m-1, d); tgt.setHours(0,0,0,0);
    const diff  = Math.round((tgt - today) / (1000*60*60*24));
    if(diff === 0) return { label:'D-DAY', today:true };
    return { label: diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`, today:false };
  };
  if (!window.getMonthKey) window.getMonthKey = function getMonthKey(){ const base = window.activeDate instanceof Date ? window.activeDate : new Date(); return `monthTodos-${base.getFullYear()}-${String(base.getMonth()+1).padStart(2,'0')}`; };
  if (!window.migrateMonthTodos) window.migrateMonthTodos = function migrateMonthTodos(raw){
    if (Array.isArray(raw)) {
      return raw.map(x => typeof x === 'string' ? ({ id: genUid(), text: x, date: '' }) : ({ id: x.id || genUid(), text: x.text||'', date: x.date||'' }));
    }
    return [];
  };
  if (!window.saveMonthTodos) window.saveMonthTodos = function saveMonthTodos(list){
    const safe = Array.isArray(list)
      ? list.map(it => ({ id: it.id || genUid(), text: String(it.text || ''), date: String(it.date || '') }))
      : [];
    localStorage.setItem(getMonthKey(), JSON.stringify(safe));
  };
  if (!window.loadMonthTodos) window.loadMonthTodos = function loadMonthTodos(){
    const raw = JSON.parse(localStorage.getItem(getMonthKey())) || [];
    return migrateMonthTodos(raw);
  };
  if (!window.removeDayTodoMirror) window.removeDayTodoMirror = function removeDayTodoMirror(uid, ymd){
    const d = ymdToDate(ymd);
    if(!d || !window.load || !window.save) return;
    const data = load(d);
    data.todos = (data.todos||[]).filter(t => t.srcMonthUid !== uid);
    save(d, data);
  };
  if (!window.upsertDayTodoFromMonth) window.upsertDayTodoFromMonth = function upsertDayTodoFromMonth(item){
    if(!item || !item.date || !window.load || !window.save) return;
    const dateObj = ymdToDate(item.date);
    if(!dateObj) return;
    const data = load(dateObj);
    data.todos = Array.isArray(data.todos) ? data.todos : [];
    const normText = (item.text || '(제목 없음)').trim();
    const uid = item.id;
    let idx = data.todos.findIndex(t => t && t.srcMonthUid === uid);
    if(idx === -1){
      idx = data.todos.findIndex(t => t && !t.srcMonthUid && String(t.text||'').trim() === normText);
      if(idx !== -1) data.todos[idx].srcMonthUid = uid;
    }
    if(idx === -1){
      data.todos.push({ text: normText, time: '', completed: false, srcMonthUid: uid });
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
  if (!window.renderQuickTodoBar) window.renderQuickTodoBar = function renderQuickTodoBar(){
    const bar = ensureQuickTodoBarMount();
    if (!bar) return;
    const cv = (window.currentView || 'month');
    if (cv === 'month' || cv === 'week') bar.style.display = 'block';
    else { bar.style.display = 'none'; return; }
    let monthTodoList = loadMonthTodos();
    bar.innerHTML = '';
    const wrap = document.createElement('div'); wrap.className = 'qt-row-wrap';
    const left = document.createElement('div'); left.className = 'qt-left';
    if (!monthTodoList.length){
      const empty = document.createElement('div'); empty.className = 'quick-todo-empty'; empty.textContent = '이번 달 계획';
      left.appendChild(empty);
    } else {
      monthTodoList.forEach((itemRaw, idx)=>{
        const item = (typeof itemRaw === 'string') ? { id: genUid(), text: itemRaw, date: '' } : { id: itemRaw.id || genUid(), text: (itemRaw.text||''), date: (itemRaw.date||'') };
        if (!itemRaw.id) { monthTodoList[idx] = item; saveMonthTodos(monthTodoList); }
        const line = document.createElement('div'); line.className = 'qt-row';
        const bullet = document.createElement('span'); bullet.className = 'qt-bullet'; bullet.textContent = '･';
        const meta = document.createElement('div'); meta.className = 'qt-meta';
        const ddaySpan = document.createElement('span'); ddaySpan.className = 'qt-dday';
        const dd = calcDday(item.date);
        if (dd) { ddaySpan.textContent = dd.label; if (dd.today) ddaySpan.classList.add('is-today'); }
        else ddaySpan.textContent = 'D-—';
        const dateBadge = document.createElement('span'); dateBadge.className = 'qt-date'; dateBadge.textContent = item.date || '날짜 미지정';
        meta.append(ddaySpan, dateBadge);
        const input = document.createElement('input'); input.className = 'qt-input'; input.placeholder = '이번 달 할 일'; input.value = item.text; input.readOnly = true;
        input.addEventListener('input', ()=>{
          monthTodoList[idx] = { ...item, text: input.value };
          saveMonthTodos(monthTodoList);
          if (item.date) upsertDayTodoFromMonth(monthTodoList[idx]);
        });
        input.addEventListener('blur', ()=>{ input.readOnly = true; });
        const icons = document.createElement('div'); icons.className = 'qt-icons';
        const calBtn = document.createElement('button'); calBtn.type = 'button'; calBtn.className = 'qt-icon'; calBtn.title = '날짜 설정'; calBtn.textContent = '📅';
        const dateInput = document.createElement('input'); dateInput.type = 'date'; dateInput.value = item.date || ''; dateInput.style.display = 'none';
        dateInput.addEventListener('change', ()=>{
          const prevDate = item.date || '';
          const nextDate = dateInput.value || '';
          item.date = nextDate;
          monthTodoList[idx] = { ...item };
          saveMonthTodos(monthTodoList);
          dateBadge.textContent = nextDate || '날짜 미지정';
          const d = calcDday(nextDate);
          if (d) { ddaySpan.textContent = d.label; ddaySpan.classList.toggle('is-today', !!d.today); }
          else { ddaySpan.textContent = 'D-—'; ddaySpan.classList.remove('is-today'); }
          if (prevDate && prevDate !== nextDate) removeDayTodoMirror(item.id, prevDate);
          if (nextDate) upsertDayTodoFromMonth(item);
          dateInput.style.display = 'none';
        });
        calBtn.addEventListener('click', (e)=>{
          e.stopPropagation();
          document.querySelectorAll('#quickTodoBar .qt-row input[type="date"]').forEach(el=>{ if(el !== dateInput) el.style.display = 'none'; });
          dateInput.style.display = (dateInput.style.display === 'none') ? '' : 'none';
          if (dateInput.style.display !== 'none') dateInput.focus();
        });
        const editBtn = document.createElement('button'); editBtn.type = 'button'; editBtn.className = 'qt-icon'; editBtn.title = '편집'; editBtn.textContent = '✏️';
        editBtn.addEventListener('click', ()=>{ input.readOnly = !input.readOnly; if(!input.readOnly){ input.focus(); const v = input.value; input.value = ''; input.value = v; } });
        const delBtn = document.createElement('button'); delBtn.type = 'button'; delBtn.className = 'qt-icon'; delBtn.title = '삭제'; delBtn.textContent = '🗑️';
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
    const right = document.createElement('div'); right.className = 'qt-right';
    const plus = document.createElement('button'); plus.className = 'qt-plus'; plus.textContent = '+';
    plus.addEventListener('click', ()=>{
      monthTodoList.push({ id: genUid(), text:'', date:'' });
      saveMonthTodos(monthTodoList);
      renderQuickTodoBar();
      const rows = document.querySelectorAll('#quickTodoBar .qt-row');
      const lastRow = rows[rows.length - 1];
      if (lastRow) {
        const input = lastRow.querySelector('.qt-input');
        if (input) { input.readOnly = false; input.focus(); const val = input.value; input.value = ''; input.value = val; }
      }
    });
    right.appendChild(plus);
    wrap.append(left, right);
    bar.appendChild(wrap);
  };
  const _rc = window.renderCalendar;
  window.renderCalendar = function patchedRenderCalendar(){
    if (typeof _rc === 'function') _rc.apply(this, arguments);
    ensureQuickTodoBarMount();
    window.renderQuickTodoBar && window.renderQuickTodoBar();
  };
  ensureQuickTodoBarMount();
  window.renderQuickTodoBar && window.renderQuickTodoBar();
})();

/* ===== Bucket List 패널 ===== */
function bucketKey(){ return 'planeat-bucket'; }
function bucketLoad(){ try { return JSON.parse(localStorage.getItem(bucketKey())) || []; } catch { return []; } }
function bucketSave(list){
  const safe = Array.isArray(list) ? list.map(x=>({
    id: x.id || ('b'+Math.random().toString(36).slice(2)+Date.now().toString(36)),
    text: String(x.text||''),
    done: !!x.done, star: !!x.star, tag: String(x.tag||'')
  })) : [];
  localStorage.setItem(bucketKey(), JSON.stringify(safe));
}
function bucketSendToMonth(item){
  if (!item || !window.loadMonthTodos || !window.saveMonthTodos) return;
  const list = window.loadMonthTodos();
  list.push({ id: window.genUid ? window.genUid() : ('m'+Date.now()), text: item.text, date: '' });
  window.saveMonthTodos(list);
  window.renderQuickTodoBar && window.renderQuickTodoBar();
  bucketToast('월간 계획으로 보냈어요.');
}
(function bucketInjectStyle(){
  if (document.getElementById('bucket-style')) return;
  const css = `
  #bucketPanel{ margin-top:10px; }
  .bucket-wrap{ border:1px solid var(--line,#e9e2d9); background:#fff; border-radius:10px; padding:10px 12px; }
  .bucket-head{ display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px; }
  .bucket-title{ font-weight:800; }
  .bucket-add{ display:flex; gap:8px; }
  .bucket-input{ flex:1; min-width:0; border:1px solid #eee; border-radius:8px; padding:8px 10px; }
  .bucket-tag{ width:100px; border:1px solid #eee; border-radius:8px; padding:8px 10px; }
  .bucket-btn{ border:1px solid var(--line,#e9e2d9); background:#fafafa; border-radius:8px; padding:8px 10px; cursor:pointer; }
  .bucket-list{ display:flex; flex-direction:column; gap:8px; }
  .bucket-item{ display:flex; align-items:center; gap:10px; padding:8px 10px; border:1px solid var(--line,#eee); border-radius:10px; background:#fff; user-select:none; }
  .bucket-item.dragging{ opacity:.6; }
  .bucket-text{ flex:1; min-width:0; }
  .bucket-text.done{ text-decoration:line-through; color:#9aa0a6; }
  .bucket-chip{ font-size:12px; padding:2px 6px; border:1px solid #e5e7eb; border-radius:999px; background:#f8fafc; white-space:nowrap; }
  .bucket-actions{ display:flex; gap:6px; }
  .bucket-icon{ border:1px solid #e5e5e5; background:#fff; border-radius:8px; padding:6px 8px; cursor:pointer; }
  .bucket-star.on{ color:#eab308; border-color:#f1e3a1; background:#fffceb; }
  .bucket-empty{ color:#888; padding:4px 0 2px; }
  .bucket-toast{ position:fixed; left:50%; transform:translateX(-50%); bottom:20px; padding:10px 14px; border-radius:999px; background:#111; color:#fff; font-size:13px; box-shadow:0 10px 24px rgba(0,0,0,.15); z-index:99999; opacity:0; transition:opacity .2s ease; }
  .bucket-toast.show{ opacity:1; }
  `;
  const st = document.createElement('style'); st.id='bucket-style'; st.textContent=css; document.head.appendChild(st);
})();
let bucketToastTimer=null;
function bucketToast(msg){
  let el = document.getElementById('bucket-toast');
  if(!el){ el = document.createElement('div'); el.id='bucket-toast'; el.className='bucket-toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(bucketToastTimer);
  bucketToastTimer = setTimeout(()=> el.classList.remove('show'), 1300);
}
function renderBucketPanel(){
  let mount = document.getElementById('bucketPanel');
  if(!mount){
    const controls = document.querySelector('.calendar-controls');
    mount = document.createElement('div'); mount.id = 'bucketPanel';
    if (controls) controls.insertAdjacentElement('afterend', mount);
    else document.body.appendChild(mount);
  }
  mount.innerHTML = '';
  const wrap = document.createElement('div'); wrap.className = 'bucket-wrap';
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
  const listEl = document.createElement('div'); listEl.className='bucket-list';
  let list = bucketLoad();
  list.sort((a,b)=>{
    if (!!b.star !== !!a.star) return b.star ? 1 : -1;
    if (!!a.done !== !!b.done) return a.done ? 1 : -1;
    return String(a.text||'').localeCompare(String(b.text||''));
  });
  if(!list.length){
    const empty = document.createElement('div'); empty.className='bucket-empty'; empty.textContent='아직 항목이 없어요. 위 입력창에 추가해보세요.';
    listEl.appendChild(empty);
  }else{
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
      const row = document.createElement('div'); row.className = 'bucket-item'; row.draggable = true; row.dataset.id = item.id;
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
      const cb = document.createElement('input'); cb.type='checkbox'; cb.checked=!!item.done;
      cb.addEventListener('change', ()=>{ item.done = cb.checked; bucketSave(list); renderBucketPanel(); });
      const span = document.createElement('span'); span.className='bucket-text' + (item.done?' done':''); span.textContent=item.text; span.title = item.text;
      span.addEventListener('dblclick', ()=>{
        const ip = document.createElement('input'); ip.className='bucket-input'; ip.value=item.text;
        ip.addEventListener('keydown', e=>{
          if(e.key==='Enter'){ item.text=ip.value.trim(); bucketSave(list); renderBucketPanel(); }
          if(e.key==='Escape'){ renderBucketPanel(); }
        });
        ip.addEventListener('blur', ()=>{ item.text=ip.value.trim(); bucketSave(list); renderBucketPanel(); });
        row.replaceChild(ip, span); ip.focus(); ip.select();
      });
      const chip = document.createElement('span'); chip.className='bucket-chip'; chip.textContent = item.tag ? ('#'+item.tag) : '무태그';
      chip.addEventListener('click', ()=>{
        const ip = document.createElement('input'); ip.className='bucket-tag'; ip.value=item.tag||'';
        ip.addEventListener('keydown', e=>{
          if(e.key==='Enter'){ item.tag = ip.value.trim(); bucketSave(list); renderBucketPanel(); }
          if(e.key==='Escape'){ renderBucketPanel(); }
        });
        ip.addEventListener('blur', ()=>{ item.tag = ip.value.trim(); bucketSave(list); renderBucketPanel(); });
        row.replaceChild(ip, chip); ip.focus(); ip.select();
      });
      const acts = document.createElement('div'); acts.className='bucket-actions';
      const star = document.createElement('button'); star.type='button'; star.className='bucket-icon bucket-star' + (item.star?' on':'' ); star.textContent='★'; star.title='중요 표시';
      star.addEventListener('click', ()=>{ item.star=!item.star; bucketSave(list); renderBucketPanel(); });
      const send = document.createElement('button'); send.type='button'; send.className='bucket-icon'; send.textContent='→월'; send.title='월간 계획으로 보내기';
      send.addEventListener('click', ()=> bucketSendToMonth(item));
      const del = document.createElement('button'); del.type='button'; del.className='bucket-icon'; del.textContent='🗑︎'; del.title='삭제';
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
/* renderCalendar 후 버킷 패널 보이기/숨김 */
(function bucketPatchRender(){
  const _rc = window.renderCalendar;
  window.renderCalendar = function patched(){
    _rc && _rc.apply(this, arguments);
    renderBucketPanel();
    const panel = document.getElementById('bucketPanel');
    if(!panel) return;
    if (window.currentView === 'day') panel.style.display = 'none';
    else panel.style.display = 'block';
  };
})();

/* ===== 알림 권한 ===== */
async function ensureNotificationPermission(force=false) {
  if (!('Notification' in window)) return false;
  if (!isSecureOrigin()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied' && !force) return false;
  try { const res = await Notification.requestPermission(); return res === 'granted'; }
  catch { return false; }
}

/* ===== 부팅 ===== */
(function boot(){
  refreshAllRestaurants();
  mountSearchInline();
  (async function initAlarmScheduler(){
    await ensureNotificationPermission();
  })();
  renderCalendar();
})();

/* ===== 메모 사진 버튼 연결(안전망) ===== */
const btn = document.getElementById('memoPhotoBtn');
const inp = document.getElementById('memoPhoto');
if (btn && inp) btn.onclick = () => inp.click();
