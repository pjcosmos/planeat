document.addEventListener('DOMContentLoaded', () => {
  const $  = (s,p=document)=>p.querySelector(s);
  const $$ = (s,p=document)=>[...p.querySelectorAll(s)];
  const on = (el,ev,fn)=>el && el.addEventListener(ev,fn);

  /* ========= 공통 상수/유틸 ========= */
  const APP_PREFIX = 'planeat';
  const keyOf = (d)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()).toDateString();
  const normalizeCategory = (raw) => {
    if (!raw) return '';
    const m = String(raw).toLowerCase();
    if (m === '아침' || m === 'morning') return 'morning';
    if (m === '점심' || m === 'lunch')   return 'lunch';
    if (m === '저녁' || m === 'dinner')  return 'dinner';
    if (m === '카페' || m === 'cafe')    return 'cafe';
    return raw;
  };
  const formatCompactDate = (d)=>{
    const yy = String(d.getFullYear() % 100).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${yy}.${mm}.${dd}`;
  };

  /* ========= 라우팅 가드(로그인 안 되어 있으면 로그인 페이지로) ========= */
  const currentUser = localStorage.getItem(`${APP_PREFIX}:currentUser`);
  if(!currentUser || currentUser === 'guest'){
    window.location.href = 'login.html';
    return; // 이하 실행 중단
  }

  /* ========= 사용자 네임스페이스 ========= */
  function userPrefix(){
    return `${APP_PREFIX}:user:${currentUser}:`;
  }

  /* ========= 날짜별 저장/읽기 ========= */
  function namespacedDayKey(d){
    return userPrefix() + keyOf(d);
  }
  function load(d){
    const nsKey = namespacedDayKey(d);
    const val = localStorage.getItem(nsKey);
    if(val) return JSON.parse(val);
    // 레거시 호환(기존 guest 키 -> 사용자 키 이동)
    const legacy = localStorage.getItem(keyOf(d));
    if(legacy){
      localStorage.setItem(nsKey, legacy);
      localStorage.removeItem(keyOf(d));
      return JSON.parse(legacy);
    }
    return { memos:[], todos:[] };
  }
  function save(d,data){
    localStorage.setItem(namespacedDayKey(d), JSON.stringify(data));
  }
  const countEvents = (d)=>{ const e=load(d); return (e.memos?.length||0)+(e.todos?.length||0); };

  /* ========= 월 단위 할일(QuickTodo) ========= */
  function getMonthKey(){
    return userPrefix() + `monthTodos-${activeDate.getFullYear()}-${String(activeDate.getMonth()+1).padStart(2,'0')}`;
  }
  function genUid(){
    return 'm' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }
  function migrateMonthTodos(raw){
    if (Array.isArray(raw)) {
      return raw.map(x => {
        if (typeof x === 'string') return { id: genUid(), text: x, date: '' };
        return {
          id: (x && x.id) ? x.id : genUid(),
          text: (x && x.text) ? x.text : '',
          date: (x && x.date) ? x.date : ''
        };
      });
    }
    return [];
  }
  function loadMonthTodos(){
    const raw = JSON.parse(localStorage.getItem(getMonthKey())) || [];
    return migrateMonthTodos(raw);
  }
  function saveMonthTodos(list){
    const clean = Array.isArray(list)
      ? list.map(it => ({ text: (it?.text||''), date: (it?.date||'') }))
      : [];
    localStorage.setItem(getMonthKey(), JSON.stringify(clean));
  }
  function ymdToDate(s){
    if(!s) return null;
    const [y,m,d] = s.split('-').map(n=>parseInt(n,10));
    if(!y || !m || !d) return null;
    return new Date(y, m-1, d);
  }
  function dedupeDayTodos(dateObj, { uid, text }){
    const data = load(dateObj);
    if(!Array.isArray(data.todos)) return;
    const norm = (s)=>String(s||'').trim();
    const keep = [];
    const seen = new Set();
    data.todos.forEach((t)=>{
      const key = t?.srcMonthUid ? `uid:${t.srcMonthUid}` : `txt:${norm(t?.text)}`;
      if(seen.has(key)) return;
      seen.add(key);
      keep.push(t);
    });
    if(keep.length !== data.todos.length){
      data.todos = keep;
      save(dateObj, data);
    }
  }
  function upsertDayTodoFromMonth(item){
    if(!item || !item.date) return;
    const dateObj = ymdToDate(item.date);
    if(!dateObj) return;
    const data = load(dateObj);
    data.todos = Array.isArray(data.todos) ? data.todos : [];
    const normText = (item.text || '(제목 없음)').trim();
    const uid = item.id;
    let idx = data.todos.findIndex(t => t && t.srcMonthUid === uid);
    if(idx === -1){
      idx = data.todos.findIndex(t => t && !t.srcMonthUid && String(t.text||'').trim() === normText);
      if(idx !== -1){ data.todos[idx].srcMonthUid = uid; }
    }
    if(idx === -1){
      data.todos.push({ text: normText, time: '', platform:'', completed: false, srcMonthUid: uid });
    }else{
      data.todos[idx].text = normText;
    }
    save(dateObj, data);
    dedupeDayTodos(dateObj, { uid, text: normText });
  }
  function removeDayTodoMirror(uid, dateStr){
    const d = ymdToDate(dateStr);
    if(!d) return;
    const data = load(d);
    if(!Array.isArray(data.todos)) return;
    const next = data.todos.filter(t => t?.srcMonthUid !== uid);
    if(next.length !== data.todos.length){
      data.todos = next;
      save(d, data);
    }
  }
  function calcDday(dateStr){
    if(!dateStr) return null;
    const [y,m,d] = dateStr.split('-').map(n=>parseInt(n,10));
    if(!y || !m || !d) return null;
    const today = new Date(); today.setHours(0,0,0,0);
    const tgt   = new Date(y, m-1, d); tgt.setHours(0,0,0,0);
    const diff  = Math.round((tgt - today) / (1000*60*60*24));
    if(diff === 0) return { label:'D-DAY', today:true };
    return { label: diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`, today:false };
  }

  /* ========= DOM ========= */
  const currentMonthYear = $('#currentMonthYear');
  const calendarGrid     = $('#calendarGrid');
  const weekOptions      = $('#weekOptions');
  const monthViewBtn     = $('#monthView');
  const weekViewBtn      = $('#weekView');
  const highlightViewBtn = $('#highlightView');
  const todayBtn         = $('#todayBtn');
  const prevMonthBtn     = $('#prevMonth');
  const nextMonthBtn     = $('#nextMonth');

  // 검색
  const searchBtn      = $('#searchBtn');
  const searchPanel    = $('#searchPanel');
  const searchInput    = $('#searchInput');
  const searchResults  = $('#searchResults');

  // 모달
  const eventModal    = $('#eventModal');
  const modalDate     = $('#modalDate');
  const closeBtn      = $('.close-button');
  const modalContent  = $('#eventModal .modal-content');

  // 저장 출력 영역
  const savedMemosDiv = $('#savedMemos');
  const savedTodosUl  = $('#savedTodos');

  // 메모 폼
  const memoForm         = $('#memoForm');
  const memoToggleHeader = $(`.toggle-header[data-target="memoForm"]`);
  const categoryWrap     = $('.memo-categories');
  const restaurantNameInput = $('#restaurantName');
  const photoUploadInput    = $('#photoUpload');
  const memoTextInput       = $('#memoText');
  const addMemoBtn          = $('#addMemoBtn');
  const photoIconBtn        = $('#photoIconBtn');
  const sponsorCheckbox     = $('#sponsorCheckbox');

  // 투두 폼
  const todoForm         = $('#todoForm');
  const todoToggleHeader = $(`.toggle-header[data-target="todoForm"]`);
  const todoInput        = $('#todoInput');
  const addTodoBtn       = $('#addTodoBtn');
  const todoTimeBtn      = $('#todoTimeBtn');
  const timePopover      = $('#timePopover');
  const todoTimePopup    = $('#todoTimePopup');
  const todoTimeDisplay  = $('#todoTimeDisplay');
  const todoPlatformSel  = $('#todoPlatform');

  // Auth UI
  const authStatus   = $('#authStatus');
  const logoutBtn    = $('#logoutBtn');

  /* ========= 상태 ========= */
  const today = new Date();
  let activeDate = new Date(today.getFullYear(), today.getMonth(), 1);
  let currentView = 'month'; // 'month' | 'week' | 'day'
  let selectedDate = null;
  let selectedCategory = '';
  let photoBase64 = '';
  let dayViewDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let editingMemoIndex = null;
  let editingTodoIndex = null;
  let nowTimer = null;
  let monthTodoList = loadMonthTodos();

  /* ========= 아이콘/라벨 ========= */
  const ICONS = {
    edit:  `<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>`,
    trash: `<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
    photo:`<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 15l-5-5-7 7"/></svg>`,
    trashMono: `
      <svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 6h16"/><path d="M10 10v7M14 10v7"/>
        <rect x="6" y="6" width="12" height="14" rx="2"/>
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
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
      </svg>`
  };
  const CATEGORY_LABELS = { morning:'아침', lunch:'점심', dinner:'저녁', cafe:'카페' };

  /* ========= Auth UI ========= */
  function refreshAuthUI(){
    if(authStatus) authStatus.textContent = `로그인: ${currentUser}`;
  }
  on(logoutBtn,'click',()=>{
    localStorage.setItem(`${APP_PREFIX}:currentUser`, 'guest');
    window.location.href = 'login.html';
  });

  /* ========= 검색 ========= */
  function toggleSearch(open){
    if(!searchPanel) return;
    const willOpen = (open!==undefined) ? open : (searchPanel.getAttribute('aria-hidden')==='true');
    searchPanel.setAttribute('aria-hidden', String(!willOpen));
    if(willOpen){ searchInput?.focus(); searchResults.innerHTML=''; }
  }
  on(searchBtn,'click',()=>toggleSearch());
  document.addEventListener('click',(e)=>{
    if(!searchPanel) return;
    if(e.target.closest('#searchPanel') || e.target.closest('#searchBtn')) return;
    toggleSearch(false);
  });
  function searchRestaurants(q){
    const query = String(q||'').trim().toLowerCase();
    if(!query) return [];
    const results = [];
    const prefix = userPrefix();
    for(let i=0;i<localStorage.length;i++){
      const k = localStorage.key(i);
      if(!k.startsWith(prefix)) continue;
      if(!k.includes(' ')) continue; // 날짜 키만
      try{
        const data = JSON.parse(localStorage.getItem(k)||'{}');
        const memos = Array.isArray(data.memos)?data.memos:[];
        memos.forEach(m=>{
          const name = (m.restaurantName||'').toLowerCase();
          if(name && name.includes(query)){
            results.push({
              key: k,
              dateStr: k.split(':').pop(),
              name: m.restaurantName,
              category: normalizeCategory(m.category||''),
              sponsored: !!m.sponsored
            });
          }
        });
      }catch(e){}
    }
    return results.slice(0,100);
  }
  on(searchInput,'input',()=>{
    const list = searchRestaurants(searchInput.value);
    searchResults.innerHTML = (list.length===0)
      ? `<div class="muted p8">결과 없음</div>`
      : list.map(r=>{
          const label = CATEGORY_LABELS[r.category] || r.category || '';
          const pin   = r.sponsored ? ' 🧷' : '';
          return `<button class="search-hit" data-date="${r.dateStr}">[${label||'메모'}] ${r.name}${pin} <span class="hit-date">${r.dateStr}</span></button>`;
        }).join('');
  });
  on(searchResults,'click',(e)=>{
    const btn = e.target.closest('.search-hit');
    if(!btn) return;
    const ds  = btn.getAttribute('data-date');
    if(!ds) return;
    const d = new Date(ds);
    if(isNaN(d)) return;
    activeDate = new Date(d.getFullYear(), d.getMonth(), 1);
    renderCalendar();
    openModal(d);
    toggleSearch(false);
  });

  /* ========= Quick Todo Bar ========= */
  function renderQuickTodoBar(){
    const bar = document.querySelector('#quickTodoBar');
    if(!bar) return;
    if(currentView === 'month' || currentView === 'week'){
      bar.style.display = 'block';
    } else {
      bar.style.display = 'none';
      return;
    }

    monthTodoList = loadMonthTodos();
    bar.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'qt-row-wrap';

    const left = document.createElement('div');
    left.className = 'qt-left';

    if (monthTodoList.length === 0){
      const empty = document.createElement('div');
      empty.className = 'quick-todo-empty';
      empty.textContent = '이번 달 계획';
      left.appendChild(empty);
    } else {
      monthTodoList.forEach((rawItem, idx)=>{
        const item = (typeof rawItem === 'string')
          ? { id: genUid(), text: rawItem, date: '' }
          : { id: rawItem.id || genUid(), text: (rawItem.text||''), date: (rawItem.date||'') };

        if (!rawItem.id) {
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

        meta.appendChild(ddaySpan);
        meta.appendChild(dateBadge);

        const input = document.createElement('input');
        input.className = 'qt-input';
        input.placeholder = '이번 달 할 일';
        input.value = item.text;
        input.readOnly = true;
        input.addEventListener('input', ()=>{
          monthTodoList[idx] = { ...item, text: input.value };
          saveMonthTodos(monthTodoList);
          upsertDayTodoFromMonth(monthTodoList[idx]);
        });
        input.addEventListener('blur', ()=>{ input.readOnly = true; });

        const icons = document.createElement('div');
        icons.className = 'qt-icons';

        const calBtn = document.createElement('button');
        calBtn.type = 'button';
        calBtn.className = 'qt-icon';
        calBtn.title = '날짜 설정';
        calBtn.innerHTML = ICONS.calendarMono;

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
        editBtn.innerHTML = ICONS.pencilMono;
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
        delBtn.innerHTML = ICONS.trashMono;
        delBtn.addEventListener('click', ()=>{
          if(item.date) removeDayTodoMirror(item.id, item.date);
          monthTodoList.splice(idx,1);
          saveMonthTodos(monthTodoList);
          renderQuickTodoBar();
        });

        icons.appendChild(calBtn);
        icons.appendChild(editBtn);
        icons.appendChild(delBtn);

        line.appendChild(bullet);
        line.appendChild(meta);
        line.appendChild(input);
        line.appendChild(icons);
        line.appendChild(dateInput);

        left.appendChild(line);
      });

      monthTodoList.forEach(it => { if(it?.date) upsertDayTodoFromMonth(it); });
    }

    const right = document.createElement('div');
    right.className = 'qt-right';
    const plus = document.createElement('button');
    plus.className = 'qt-plus';
    plus.textContent = '+';
    plus.addEventListener('click', ()=>{
      monthTodoList.push({ text:'', date:'' });
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

    wrap.appendChild(left);
    wrap.appendChild(right);
    bar.appendChild(wrap);
  }

  /* ========= 리스트 빌더 ========= */
  function buildRestaurantList(date, { mode = 'month' } = {}) {
    const ev = load(date);
    const groups = { morning:[], lunch:[], dinner:[], cafe:[] };
    (ev.memos || []).forEach(m => {
      const cat = normalizeCategory(m.category);
      if (!m || !m.restaurantName || !groups.hasOwnProperty(cat)) return;
      groups[cat].push({ name: m.restaurantName.trim(), sponsored: !!m.sponsored });
    });
    const hasAny = Object.values(groups).some(arr => arr.length > 0);
    if (!hasAny) return null;

    const wrap = document.createElement("div");
    wrap.className = (mode === 'week') ? 'week-listing' : 'day-list';

    ["morning","lunch","dinner","cafe"].forEach(cat => {
      const arr = groups[cat];
      if (!arr || arr.length === 0) return;

      const row = document.createElement("div");
      row.className = "dl-row";

      const names = document.createElement("div");
      names.className = "dl-names";

      arr.forEach(({name, sponsored}) => {
        const item = document.createElement('div');
        item.className = 'dl-item';

        const bar = document.createElement('span');
        bar.className = 'dl-bar-text';
        bar.textContent = '▌';
        bar.dataset.cat = (cat === 'cafe') ? 'cafe' : 'meal';

        const label = document.createElement('span');
        label.textContent = name + (sponsored ? ' 🧷' : '');

        item.append(bar, label);
        names.appendChild(item);
      });

      row.appendChild(names);
      wrap.appendChild(row);
    });

    return wrap;
  }

  function buildMonthSingleLine(date) {
    const ev = load(date);
    const memos = (ev.memos || [])
      .map((m, i) => ({ ...m, category: normalizeCategory(m.category || ''), _i: i }))
      .filter(m => m.restaurantName && m.category);

    if (memos.length === 0) return null;

    const mealOrder = ['morning', 'lunch', 'dinner'];
    const items = [];
    mealOrder.forEach(cat => {
      memos.filter(m => m.category === cat).forEach(m => {
        items.push({ name: m.restaurantName.trim(), cat: 'meal', sponsored: !!m.sponsored });
      });
    });
    memos.filter(m => m.category === 'cafe').forEach(m => {
      items.push({ name: m.restaurantName.trim(), cat: 'cafe', sponsored: !!m.sponsored });
    });

    if (items.length === 0) return null;

    const wrap = document.createElement('div');
    wrap.className = 'day-list';
    const row  = document.createElement('div');
    row.className = 'dl-row';

    const namesBox = document.createElement('div');
    namesBox.className = 'dl-names';

    items.forEach(({name, cat, sponsored}) => {
      const item = document.createElement('div');
      item.className = 'dl-item';

      const bar = document.createElement('span');
      bar.className = 'dl-bar-text';
      bar.textContent = '▌';
      bar.dataset.cat = cat;

      const label = document.createElement('span');
      label.textContent = name + (sponsored ? ' 🧷' : '');

      item.append(bar, label);
      namesBox.appendChild(item);
    });

    row.appendChild(namesBox);
    wrap.appendChild(row);
    return wrap;
  }

  /* ========= 토글 ========= */
  const attachToggle=(header,content)=>{
    on(header,'click',()=>{
      const open = content.classList.contains('open');
      content.classList.toggle('open', !open);
      header.setAttribute('aria-expanded', String(!open));
      if (!open && modalContent) modalContent.scrollTop = header.offsetTop - 10;
    });
  };
  attachToggle(memoToggleHeader, memoForm);
  attachToggle(todoToggleHeader, todoForm);

  /* ========= 모달 ========= */
  const openModal = (date) => {
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
  };
  const closeModal = () => {
    if (!eventModal) return;
    eventModal.setAttribute('aria-hidden','true');
    eventModal.style.display = 'none';
    document.body.classList.remove('modal-open');
  };
  on(closeBtn,'click',closeModal);
  on(document,'keydown',(e)=>{ if(e.key==='Escape') closeModal(); });
  on(eventModal,'click',(e)=>{ if(e.target===eventModal) closeModal(); });


  const renderSaved = () => {
    if (!selectedDate) return;
    const { memos, todos } = load(selectedDate);

    // MEMOS
    savedMemosDiv.innerHTML = '';
    if (!memos.length) {
      savedMemosDiv.innerHTML = `<div class="muted">저장된 메모가 없습니다.</div>`;
    } else {
      const rank = { morning: 0, lunch: 1, dinner: 2, cafe: 3 };
      const displayMemos = memos
        .map((m, i) => ({ ...m, _i: i, category: normalizeCategory(m.category || '') }))
        .sort((a, b) => {
          const ra = rank[a.category] ?? 99;
          const rb = rank[b.category] ?? 99;
          if (ra !== rb) return ra - rb;
          return a._i - b._i;
        });

      displayMemos.forEach((m) => {
        const idx = m._i;
        const isEditing = editingMemoIndex === idx;

        const wrap = document.createElement('div');
        wrap.className = 'saved-memo-item';

        const actions = document.createElement('div');
        actions.className = 'item-actions';
        const ebtn = document.createElement('button'); ebtn.className='icon-btn'; ebtn.title='수정'; ebtn.innerHTML = ICONS.edit;
        const dbtn = document.createElement('button'); dbtn.className='icon-btn'; dbtn.title='삭제'; dbtn.innerHTML = ICONS.trash;
        actions.appendChild(ebtn); actions.appendChild(dbtn);
        wrap.appendChild(actions);

        ebtn.addEventListener('click', ()=>{ editingMemoIndex = (isEditing ? null : idx); renderSaved(); });
        dbtn.addEventListener('click', ()=>{
          if(!confirm('이 메모를 삭제할까요?')) return;
          const data = load(selectedDate); data.memos.splice(idx,1); save(selectedDate,data);
          renderSaved(); renderCalendar();
        });

        if (!isEditing) {
          const title = document.createElement('h5');
          const catLabel = m.category ? (CATEGORY_LABELS[m.category] || m.category) : '';
          const pin = m.sponsored ? ' 🧷' : '';
          title.textContent = `${catLabel?`[${catLabel}] `:''}${m.restaurantName||''}${pin}`;
          wrap.appendChild(title);
          if (m.memoText){ const p=document.createElement('p'); p.textContent=m.memoText; wrap.appendChild(p); }
          if (m.photo){ const img=document.createElement('img'); img.src=m.photo; img.alt='메모 사진'; wrap.appendChild(img); }
        } else {
          const box=document.createElement('div'); box.className='inline-editor';
          const row1=document.createElement('div'); row1.className='inline-row';
          const titleInput=document.createElement('input'); titleInput.className='input'; titleInput.placeholder='식당 이름'; titleInput.value=m.restaurantName||'';
          const textArea=document.createElement('textarea'); textArea.className='textarea'; textArea.placeholder='메모 내용'; textArea.value=m.memoText||'';
          row1.appendChild(titleInput); row1.appendChild(textArea);

          const row2=document.createElement('div'); row2.className='inline-row grid-2';
          let tempPhoto = m.photo || '';

          const left=document.createElement('div');
          const thumbWrap=document.createElement('div'); thumbWrap.className='thumb-wrap';
          const renderThumb=()=>{
            thumbWrap.innerHTML='';
            if (tempPhoto){
              const img=document.createElement('img'); img.className='thumb'; img.src=tempPhoto; img.alt='사진 미리보기';
              const del=document.createElement('button'); del.className='thumb-delete'; del.title='사진 삭제'; del.textContent='×';
              del.addEventListener('click',(e)=>{ e.stopPropagation(); tempPhoto=''; renderThumb(); });
              thumbWrap.appendChild(img); thumbWrap.appendChild(del);
            } else {
              const ph=document.createElement('div'); ph.className='photo-placeholder';
              ph.innerHTML = ICONS.photo + `<span class="muted">사진 없음</span>`;
              thumbWrap.appendChild(ph);
            }
          };
          renderThumb();
          left.appendChild(thumbWrap);

          const right=document.createElement('div');
          const hiddenFile=document.createElement('input'); hiddenFile.type='file'; hiddenFile.accept='image/jpeg'; hiddenFile.className='file-hidden';
          const addBtn=document.createElement('button'); addBtn.type='button'; addBtn.className='icon-btn'; addBtn.title='사진 추가/변경'; addBtn.innerHTML=ICONS.photo;
          addBtn.addEventListener('click',()=>hiddenFile.click());
          hiddenFile.addEventListener('change',(e)=>{
            const f=e.target.files && e.target.files[0]; if(!f) return;
            if(!(f.type==='image/jpeg' || /\.jpe?g$/i.test(f.name))){
              alert('JPEG(.jpg, .jpeg) 파일만 업로드할 수 있습니다.');
              hiddenFile.value='';
              return;
            }
            const r=new FileReader();
            r.onload=(ev)=>{ tempPhoto = ev.target.result; renderThumb(); };
            r.readAsDataURL(f);
          });
          right.appendChild(addBtn); right.appendChild(hiddenFile);

          row2.appendChild(left); row2.appendChild(right);

          const row2b = document.createElement('div');
          row2b.className = 'inline-row';
          const sponsorLine = document.createElement('label');
          const sponsorInput = document.createElement('input');
          sponsorInput.type='checkbox';
          sponsorInput.checked = !!m.sponsored;
          sponsorLine.appendChild(sponsorInput);
          sponsorLine.appendChild(document.createTextNode(' 협찬'));
          row2b.appendChild(sponsorLine);

          const row3=document.createElement('div'); row3.className='inline-actions';
          const cancel=document.createElement('button'); cancel.className='btn'; cancel.textContent='취소';
          const saveBtn=document.createElement('button'); saveBtn.className='btn primary'; saveBtn.textContent='저장';
          cancel.addEventListener('click',()=>{ editingMemoIndex=null; renderSaved(); });
          saveBtn.addEventListener('click',()=>{
            const data=load(selectedDate);
            const item=data.memos[idx]; if(!item) return;
            item.restaurantName = titleInput.value.trim();
            item.memoText       = textArea.value.trim();
            item.photo          = tempPhoto;
            item.sponsored      = !!sponsorInput.checked;
            save(selectedDate,data); editingMemoIndex=null; renderSaved(); renderCalendar();
          });
          row3.appendChild(cancel); row3.appendChild(saveBtn);

          box.appendChild(row1); box.appendChild(row2); box.appendChild(row2b); box.appendChild(row3);
          wrap.appendChild(box);
        }
        savedMemosDiv.appendChild(wrap);
      });
    }

    // TODOS (카테고리 = 플랫폼 가나다 정렬)
    savedTodosUl.innerHTML = '';
    if (!todos.length){
      const li=document.createElement('li'); li.className='muted'; li.textContent='저장된 할 일이 없습니다.'; savedTodosUl.appendChild(li);
    } else {
      const sorted = [...todos].map((t,i)=>({ ...t, _i:i }))
        .sort((a,b)=>{
          const pa = a.platform || '';
          const pb = b.platform || '';
          const c1 = pa.localeCompare(pb, 'ko');
          if(c1!==0) return c1;
          return (a.text||'').localeCompare(b.text||'', 'ko');
        });

      sorted.forEach((tWrap)=>{
        const t = tWrap; const idx = t._i;
        const isEditing = editingTodoIndex===idx;
        const li=document.createElement('li'); li.className='todo-item'+(t.completed?' completed':'');
        const actions=document.createElement('div'); actions.className='item-actions';
        const ebtn=document.createElement('button'); ebtn.className='icon-btn'; ebtn.title='수정';  ebtn.innerHTML=ICONS.edit;
        const dbtn=document.createElement('button'); dbtn.className='icon-btn'; dbtn.title='삭제';  dbtn.innerHTML=ICONS.trash;
        actions.appendChild(ebtn); actions.appendChild(dbtn);

        const main=document.createElement('div'); main.style.flex='1'; main.style.minWidth='0';
        if(!isEditing){
          const row=document.createElement('div'); row.style.display='flex'; row.style.alignItems='center'; row.style.gap='8px';

          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.className = 'todo-check';
          cb.checked = !!t.completed;
          cb.addEventListener('change', () => {
            const data = load(selectedDate);
            data.todos[idx].completed = cb.checked;
            save(selectedDate, data);
            renderSaved(); renderCalendar();
          });
          row.appendChild(cb);

          if (t.time) {
            const timeBadge = document.createElement('span');
            timeBadge.className = 'todo-time-badge';
            timeBadge.textContent = t.time;
            row.appendChild(timeBadge);
          }
          if (t.platform){
            const pfBadge = document.createElement('span');
            pfBadge.className = 'todo-platform-badge';
            pfBadge.textContent = t.platform;
            row.appendChild(pfBadge);
          }

          const text=document.createElement('span'); text.className='todo-text'; text.textContent=t.text;
          row.appendChild(text);

          main.appendChild(row);
        } else {
          const form=document.createElement('div'); form.className='inline-editor';
          const line=document.createElement('div'); line.className='inline-row grid-2';
          const input=document.createElement('input'); input.className='input'; input.value=t.text||'';
          const timeEdit=document.createElement('input'); timeEdit.type='time'; timeEdit.className='input'; timeEdit.value=t.time||'';
          line.appendChild(input); line.appendChild(timeEdit);

          const line2=document.createElement('div'); line2.className='inline-row';
          const pfSel=document.createElement('select'); pfSel.className='input';
          pfSel.innerHTML = `<option value="">플랫폼 선택</option>
            <option value="블로그">블로그</option>
            <option value="인스타">인스타</option>
            <option value="유튜브">유튜브</option>`;
          pfSel.value = t.platform||'';
          line2.appendChild(pfSel);
          form.appendChild(line); form.appendChild(line2);

          const a=document.createElement('div'); a.className='inline-actions';
          const cancel=document.createElement('button'); cancel.className='btn'; cancel.textContent='취소';
          const saveBtn=document.createElement('button'); saveBtn.className='btn primary'; saveBtn.textContent='저장';
          cancel.addEventListener('click',()=>{ editingTodoIndex=null; renderSaved(); });
          saveBtn.addEventListener('click',()=>{
            const data=load(selectedDate);
            data.todos[idx].text = input.value.trim();
            data.todos[idx].time = timeEdit.value.trim();
            data.todos[idx].platform = pfSel.value.trim();
            save(selectedDate,data); editingTodoIndex=null; renderSaved(); renderCalendar();
          });
          a.appendChild(cancel); a.appendChild(saveBtn);
          form.appendChild(a);
          main.appendChild(form);
        }

        ebtn.addEventListener('click',()=>{ editingTodoIndex=(isEditing?null:idx); renderSaved(); });
        dbtn.addEventListener('click',()=>{
          if(!confirm('이 할 일을 삭제할까요?')) return;
          const data=load(selectedDate); data.todos.splice(idx,1); save(selectedDate,data); renderSaved(); renderCalendar();
        });

        li.appendChild(main); li.appendChild(actions);
        savedTodosUl.appendChild(li);
      });
    }
  };

  /* ========= 입력 핸들러 ========= */
  const clearMemoInputs = () => {
    selectedCategory=''; photoBase64='';
    restaurantNameInput && (restaurantNameInput.value='');
    photoUploadInput && (photoUploadInput.value='');
    memoTextInput && (memoTextInput.value='');
    sponsorCheckbox && (sponsorCheckbox.checked=false);
    if (categoryWrap) $$('.chip',categoryWrap).forEach(c=>c.classList.remove('active'));
  };
  const clearTodoInput = () => {
    todoInput && (todoInput.value='');
    todoTimePopup && (todoTimePopup.value='');
    todoTimeDisplay && (todoTimeDisplay.textContent='');
    todoPlatformSel && (todoPlatformSel.value='');
  };

  on(categoryWrap,'click',(e)=>{
    const btn=e.target.closest('.chip'); if(!btn) return;
    $$('.chip',categoryWrap).forEach(c=>c.classList.remove('active'));
    btn.classList.add('active');
    selectedCategory=btn.dataset.category||'';
  });
  on(photoUploadInput,'change',(e)=>{
    const f=e.target.files?.[0]; if(!f) return;
    if(!(f.type==='image/jpeg' || /\.jpe?g$/i.test(f.name))){
      alert('JPEG(.jpg, .jpeg) 파일만 업로드할 수 있습니다.');
      photoUploadInput.value='';
      return;
    }
    const r=new FileReader();
    r.onload=(ev)=>{ photoBase64=ev.target.result; };
    r.readAsDataURL(f);
  });
  on(photoIconBtn,'click',()=>{ photoUploadInput && photoUploadInput.click(); });

  on(addMemoBtn,'click',()=>{
    if(!selectedDate) return;
    const name=(restaurantNameInput?.value||'').trim();
    const memoText=(memoTextInput?.value||'').trim();
    const sponsored = !!(sponsorCheckbox && sponsorCheckbox.checked);
    if(!name && !memoText && !photoBase64){ alert('메모, 식당 이름 또는 사진 중 하나는 입력해주세요.'); return; }
    const data=load(selectedDate);
    data.memos.push({ category: normalizeCategory(selectedCategory), restaurantName: name, memoText, photo: photoBase64, ts: Date.now(), sponsored });
    save(selectedDate,data);
    clearMemoInputs(); renderSaved(); renderCalendar();
  });

  on(addTodoBtn,'click',()=>{
    if(!selectedDate) return;
    const text = (todoInput?.value||'').trim();
    const time = ((todoTimePopup && todoTimePopup.value) || '').trim();
    const platform = (todoPlatformSel?.value || '').trim();
    if(!text){ alert('할 일을 입력하세요.'); return; }
    const data = load(selectedDate);
    data.todos.push({ text, time, platform, completed:false });
    save(selectedDate,data);
    clearTodoInput();
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

  /* ========= 캘린더 렌더 ========= */
  function setDayPhoto(cellEl, src){
    cellEl.classList.add('has-photo');
    let under = cellEl.querySelector('.day-bg-underlay');
    let main  = cellEl.querySelector('.day-bg-img');
    if(!under){ under = document.createElement('img'); under.className = 'day-bg-underlay'; cellEl.prepend(under); }
    if(!main ){ main  = document.createElement('img'); main.className  = 'day-bg-img';      cellEl.prepend(main);  }
    under.src = src; main.src = src;
  }

  function renderCalendar() {
    calendarGrid.innerHTML='';
    weekOptions.innerHTML='';

    renderQuickTodoBar();

    if (currentView === 'day') {
      currentMonthYear.innerHTML = `<span class="compact-date">${formatCompactDate(activeDate)}</span>`;
    } else {
      currentMonthYear.textContent = activeDate.toLocaleString('ko-KR', { year:'numeric', month:'long' });
    }

    const y=activeDate.getFullYear(), m=activeDate.getMonth();
    const firstDow=new Date(y,m,1).getDay();
    const daysIn =new Date(y,m+1,0).getDate();

    ['일','월','화','수','목','금','토'].forEach(n=>{
      const d=document.createElement('div'); d.className='day-name'; d.textContent=n; calendarGrid.appendChild(d);
    });

    for(let i=0;i<firstDow;i++) calendarGrid.appendChild(document.createElement('div'));

    for(let day=1; day<=daysIn; day++){
      const cell=document.createElement('div'); cell.className='current-month';
      const num=document.createElement('div'); num.className='date-number'; num.textContent=String(day);
      cell.appendChild(num);

      const d=new Date(y,m,day);
      if(d.toDateString()===new Date().toDateString()) cell.classList.add('today');

      const ev = load(d);
      const photoMemo = [...(ev.memos || [])].reverse().find(m => m.photo);
      if (photoMemo?.photo) setDayPhoto(cell, photoMemo.photo);

      const oneLine = buildMonthSingleLine(d);
      if (oneLine) cell.appendChild(oneLine);

      on(cell,'click',()=>openModal(d));
      calendarGrid.appendChild(cell);
    }

    if(currentView==='month'){
      calendarGrid.style.display='grid';
      weekOptions.style.display='none';
    } else if(currentView==='week'){
      calendarGrid.style.display='none';
      weekOptions.style.display='flex';
      renderWeekList();
    } else if(currentView==='day'){
      calendarGrid.style.display='block';
      weekOptions.style.display='block';
      renderDayTimeline();
    } else {
      calendarGrid.style.display='none';
      weekOptions.style.display='none';
    }
  }

  /* ========= 주/일 뷰 ========= */
  const renderWeekList = () => {
    const y=activeDate.getFullYear(), m=activeDate.getMonth();
    const first=new Date(y,m,1), last=new Date(y,m+1,0);
    let buf=[], weeks=[];
    for(let d=new Date(first); d<=last; d.setDate(d.getDate()+1)){
      buf.push(new Date(d));
      if(d.getDay()===6 || d.getTime()===last.getTime()){ weeks.push([...buf]); buf=[]; }
    }

    weekOptions.innerHTML='';
    weeks.forEach((days,i)=>{
      const item=document.createElement('div'); item.className='week-item'; item.textContent=`${i+1}주차`;
      item.addEventListener('click',()=>{
        $$('.week-item').forEach(el=>el.classList.remove('selected'));
        item.classList.add('selected');
        renderWeekDays(days);
      });
      weekOptions.appendChild(item);
    });

    const now=Date.now(); let picked=false;
    weeks.forEach((days,i)=>{
      const s=days[0].getTime(), e=days[days.length-1].getTime();
      if(!picked && now>=s && now<=e){ weekOptions.children[i].click(); picked=true; }
    });
    if(!picked && weeks.length) weekOptions.children[0].click();
  };

  function renderWeekDays(days){
    calendarGrid.innerHTML=''; calendarGrid.style.display='block';
    const list=document.createElement('div'); list.className='week-list'; calendarGrid.appendChild(list);
    const names=['일','월','화','수','목','금','토'];

    days.forEach(d=>{
      const card=document.createElement('div'); card.className='week-card';
      if(d.toDateString()===new Date().toDateString()) card.classList.add('today');

      const badge=document.createElement('div'); badge.className='date-badge';
      const day=document.createElement('div'); day.className='day'; day.textContent=String(d.getDate());
      const month=document.createElement('div'); month.className='month'; month.textContent=`${d.getMonth()+1}월`;
      badge.appendChild(day); badge.appendChild(month);

      const label=document.createElement('div'); label.className='weekday-label'; label.textContent=names[d.getDay()];

      const namesEl = buildRestaurantList(d, { mode:'week' });

      const meta=document.createElement('div'); meta.className='meta';
      const cnt=countEvents(d); if(cnt>0){ const pill=document.createElement('span'); pill.className='pill'; pill.textContent=`${cnt}개`; meta.appendChild(pill); }
      const chev=document.createElement('span'); chev.textContent='›'; meta.appendChild(chev);

      card.appendChild(badge);
      card.appendChild(label);
      if (namesEl) card.appendChild(namesEl);
      card.appendChild(meta);

      on(card,'click',()=>openModal(d));
      list.appendChild(card);
    });
  }

  function renderDayTimeline(){
    weekOptions.innerHTML='';
    const bar=document.createElement('div'); bar.className='day-bar';

    const prev = document.createElement('button'); prev.className='btn'; prev.textContent='yesterday';
    prev.addEventListener('click',()=>{ dayViewDate.setDate(dayViewDate.getDate()-1); activeDate=new Date(dayViewDate.getFullYear(), dayViewDate.getMonth(), 1); renderDayTimeline(); });

    const todayBtnLocal = document.createElement('button'); todayBtnLocal.className='btn'; todayBtnLocal.textContent='Today';
    todayBtnLocal.addEventListener('click',()=>{ const t=new Date(); dayViewDate=new Date(t.getFullYear(), t.getMonth(), t.getDate()); activeDate=new Date(dayViewDate.getFullYear(), dayViewDate.getMonth(), 1); renderDayTimeline(); });

    const next = document.createElement('button'); next.className='btn'; next.textContent='tomorrow';
    next.addEventListener('click',()=>{ dayViewDate.setDate(dayViewDate.getDate()+1); activeDate=new Date(dayViewDate.getFullYear(), dayViewDate.getMonth(), 1); renderDayTimeline(); });

    const dateSmall=document.createElement('div'); dateSmall.className='date-label';
    dateSmall.textContent = formatCompactDate(dayViewDate);

    const spacer=document.createElement('div'); spacer.style.flex='1';

    bar.append(prev,todayBtnLocal,next,dateSmall,spacer);
    weekOptions.appendChild(bar);

    calendarGrid.innerHTML='';
    const wrap=document.createElement('div'); wrap.className='day-timeline';
    const inner=document.createElement('div'); inner.className='timeline-wrap';

    const hours=Array.from({length:24},(_,i)=>i);
    const dayData=load(dayViewDate);
    const todosAll=Array.isArray(dayData.todos)?dayData.todos:[];
    hours.forEach(h=>{
      const slot=document.createElement('div'); slot.className='time-slot';
      const lab=document.createElement('div'); lab.className='time-label';
      const hh=String(h).padStart(2,'0'); lab.textContent=`${hh}:00`;
      const body=document.createElement('div'); body.className='slot-body';
      const list=todosAll.filter(t=> (t.time||'').startsWith(`${hh}:`));
      list.forEach(t=>{
        const chip=document.createElement('label');
        chip.className='todo-chip'+(t.completed?' done':'');
        const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=!!t.completed;
        cb.addEventListener('change',()=>{
          const data=load(dayViewDate);
          const idx = data.todos.indexOf(t);
          if(idx>-1){ data.todos[idx].completed=cb.checked; save(dayViewDate,data); renderDayTimeline(); if(selectedDate && keyOf(selectedDate)===keyOf(dayViewDate)) renderSaved(); }
        });
        const timeSpan=document.createElement('span'); timeSpan.textContent=t.time||'--:--';
        timeSpan.style.fontWeight='700'; timeSpan.style.fontSize='12px';
        const text=document.createElement('span'); text.textContent=t.text||'(제목 없음)';

        chip.append(cb,timeSpan,text);
        body.appendChild(chip);
      });

      slot.append(lab, body);
      inner.appendChild(slot);
    });

    // 현재시간 라인
    let nowLine = inner.querySelector('.now-line');
    let nowBadge= inner.querySelector('.now-badge');
    if(!nowLine){
      nowLine = document.createElement('div');
      nowLine.className = 'now-line';
      inner.appendChild(nowLine);
      nowBadge = document.createElement('div');
      nowBadge.className = 'now-badge';
      inner.appendChild(nowBadge);
    }
    function positionNow(){
      const t = new Date();
      const hh = t.getHours();
      const mm = t.getMinutes();
      const slots = [...inner.querySelectorAll('.time-slot')];
      if(slots.length!==24) return;
      const slot = slots[hh];
      const topBase = slot.offsetTop;
      const y = topBase + (slot.offsetHeight * (mm/60));
      nowLine.style.top = `${y}px`;
      nowBadge.style.top= `${y - 10}px`;
      nowBadge.textContent = t.toLocaleTimeString('ko-KR', {hour:'2-digit', minute:'2-digit'});
    }
    positionNow();
    clearInterval(nowTimer);
    nowTimer = setInterval(positionNow, 1000 * 30);

    wrap.appendChild(inner);
    calendarGrid.appendChild(wrap);
  }

  /* ========= 보기 전환/네비 ========= */
  on(monthViewBtn,'click',()=>{ 
    currentView='month';
    monthViewBtn.classList.add('active'); weekViewBtn.classList.remove('active'); highlightViewBtn.classList.remove('active');
    renderCalendar();
  });
  on(weekViewBtn,'click', ()=>{ 
    currentView='week';
    monthViewBtn.classList.remove('active'); weekViewBtn.classList.add('active'); highlightViewBtn.classList.remove('active');
    renderCalendar();
  });
  on(highlightViewBtn,'click',()=>{ 
    currentView='day';
    monthViewBtn.classList.remove('active'); weekViewBtn.classList.remove('active'); highlightViewBtn.classList.add('active');
    const t=new Date();
    dayViewDate = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    activeDate  = new Date(dayViewDate.getFullYear(), dayViewDate.getMonth(), 1);
    renderCalendar();
  });

  on(todayBtn,'click',()=>{
    const t=new Date();
    activeDate      = new Date(t.getFullYear(), t.getMonth(), 1);
    dayViewDate     = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    renderCalendar();
  });

  on(prevMonthBtn,'click',()=>{ activeDate.setMonth(activeDate.getMonth()-1); renderCalendar(); });
  on(nextMonthBtn,'click',()=>{ activeDate.setMonth(activeDate.getMonth()+1); renderCalendar(); });

  /* ========= 초기 렌더 ========= */
  refreshAuthUI();
  renderCalendar();
});
