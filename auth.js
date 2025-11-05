// auth.js — 로컬스토리지 기반 + (옵션) 원격 동기화 추가
// API 시그니처/동작 동일: getProfile/login/logout/signup/resetPassword* 그대로 사용 가능
// ★ 설정만 하면 기기간 동기화 됨 (Google Apps Script 웹앱 등)

(function (global) {
  // ====== [설정] 원격 동기화 엔드포인트 (없으면 로컬만 동작) ======
  const SYNC_URL   = 'https://script.google.com/macros/s/AKfycbyDeFYLmiAh3Z_h0dJ8oGGZvjQyXAq3uq-C0qAy_VRGJ752NoqFKseIYP9mHRZS1T3Q/exec'; // 예: https://script.google.com/macros/s/AKfycb.../exec
  const SYNC_TOKEN = 'mGZ7f6E2_1r7yQ9hJpKz3sWc8VbDnLx0tUeR4iYo'; // Code.gs의 SERVER_TOKEN과 동일하게

  const USER_KEY    = 'planeat_users_v1';
  const SESSION_KEY = 'planeat_session_v1';
  const SYNC_FLAG   = 'planeat_users_synced_v1'; // 최초 1회 pull 여부 표시

  // ====== Local helpers ======
  const readUsersLocal = () => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)) || {}; }
    catch { return {}; }
  };
  const writeUsersLocal = (users) => {
    localStorage.setItem(USER_KEY, JSON.stringify(users || {}));
  };

  const getSessionId = () => {
    try { return localStorage.getItem(SESSION_KEY) || null; }
    catch { return null; }
  };
  const setSessionId = (id) => {
    if (id) localStorage.setItem(SESSION_KEY, id);
    else localStorage.removeItem(SESSION_KEY);
  };

  // ====== Remote helpers ======
  async function pullUsersRemoteOnce() {
    if (!SYNC_URL) return;
    if (localStorage.getItem(SYNC_FLAG) === '1') return;
  
    try {
      const res = await fetch(`${SYNC_URL}?action=getUsers&token=${SYNC_TOKEN}`, { method:'GET' });
      if (!res.ok) throw new Error('pull failed');
      const remoteUsers = await res.json();
      const localUsers = readUsersLocal();
      const merged = { ...localUsers, ...remoteUsers };
      writeUsersLocal(merged);
      localStorage.setItem(SYNC_FLAG, '1');
    } catch (e) {
      // 로컬만 사용해도 앱은 정상 동작
    }
  }
  

  function pushUsersRemote(users) {
    if (!SYNC_URL) return;
    // fire-and-forget: 화면 블로킹 없이 비동기 전송
    try {
      navigator.sendBeacon?.(SYNC_URL, new Blob([JSON.stringify({
        action:'setUsers', users, token: SYNC_TOKEN
      })], { type:'application/json' })) ||
      fetch(SYNC_URL, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ action:'setUsers', users, token: SYNC_TOKEN })
      }).catch(()=>{});
    } catch {}
  }

  // ====== Validation ======
  function validateId(id) {
    if (!id || !/^[A-Za-z0-9_\-\.]{3,32}$/.test(id)) {
      return { ok:false, msg:'아이디는 3~32자의 영문/숫자/._- 만 허용' };
    }
    return { ok:true };
  }
  function validatePw(pw) {
    if (!pw || pw.length < 8) return { ok:false, msg:'비밀번호는 8자 이상' };
    return { ok:true };
  }

  // ====== Public API (동기 인터페이스 유지) ======
  const api = {
    // 앱 시작 시 1회 원격 → 로컬 머지 (호출 안해도 즉시 실행 아래에서 자동 호출)
    async initSyncOnce() {
      await pullUsersRemoteOnce();
    },

    getProfile() {
      const id = getSessionId();
      if (!id) return null;
      const users = readUsersLocal();
      const u = users[id];
      if (!u) { setSessionId(null); return null; }
      const { password, ...safe } = u;
      return safe;
    },

    login(id, password) {
      const users = readUsersLocal();
      const u = users[id];
      if (!u) return false;
      if (u.password !== String(password)) return false;
      setSessionId(id);
      return true;
    },

    logout() {
      setSessionId(null);
      return true;
    },

    signup({ id, password, realName = '', nickname = '', memo = '' }) {
      id = (id || '').trim();
      password = String(password || '');

      const v1 = validateId(id); if (!v1.ok) return { success:false, message: v1.msg };
      const v2 = validatePw(password); if (!v2.ok) return { success:false, message: v2.msg };

      const users = readUsersLocal();
      if (users[id]) return { success:false, message:'이미 존재하는 아이디입니다.' };

      users[id] = { id, password, realName: realName.trim(), nickname: nickname.trim(), memo: memo.trim(), createdAt: Date.now() };
      writeUsersLocal(users);
      pushUsersRemote(users); // ← 원격에도 반영
      return { success:true };
    },

    resetPasswordByHints({ nickname, realName, memo, newPassword }) {
      const v2 = validatePw(newPassword); if (!v2.ok) return { success:false, message: v2.msg };
      const users = readUsersLocal();
      const ids = Object.keys(users);
      const foundId = ids.find(id => {
        const u = users[id];
        return (String(u.nickname||'') === String(nickname||'').trim()) &&
               (String(u.realName||'') === String(realName||'').trim()) &&
               (String(u.memo||'') === String(memo||'').trim());
      });
      if (!foundId) return { success:false, message:'일치하는 사용자를 찾을 수 없습니다.' };
      users[foundId].password = String(newPassword);
      writeUsersLocal(users);
      pushUsersRemote(users); // ← 원격에도 반영
      return { success:true };
    },

    resetPasswordByIdName({ id, realName, newPassword }) {
      id = (id || '').trim();
      realName = (realName || '').trim();
      const v2 = validatePw(newPassword); if (!v2.ok) return { success:false, message: v2.msg };

      const users = readUsersLocal();
      const u = users[id];
      if (!u) return { success:false, message:'존재하지 않는 아이디입니다.' };
      if (String(u.realName || '') !== realName) {
        return { success:false, message:'실명이 일치하지 않습니다.' };
      }
      u.password = String(newPassword);
      writeUsersLocal(users);
      pushUsersRemote(users); // ← 원격에도 반영
      return { success:true };
    }
  };

  global.auth = api;
  if (typeof window !== 'undefined') window.auth = api;

  // 페이지 로드되면 즉시 1회 동기화 시도 (호출부 수정 불필요)
  (async ()=>{ await api.initSyncOnce(); })();

})(typeof globalThis !== 'undefined' ? globalThis : window);

