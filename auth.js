// auth.js — 로컬스토리지 기반 초간단 계정/세션 관리 (요청 반영: 아이디+실명으로 비번 재설정)
// 기존 인터페이스 유지 + resetPasswordByIdName 추가

(function (global) {
  const USER_KEY = 'planeat_users_v1';
  const SESSION_KEY = 'planeat_session_v1';

  const readUsers = () => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)) || {}; }
    catch { return {}; }
  };
  const writeUsers = (users) => {
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

  // 간단 검증
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

  const api = {
    // 현재 로그인한 프로필 반환(비번 제외)
    getProfile() {
      const id = getSessionId();
      if (!id) return null;
      const users = readUsers();
      const u = users[id];
      if (!u) { setSessionId(null); return null; }
      const { password, ...safe } = u;
      return safe;
    },

    // 로그인
    login(id, password) {
      const users = readUsers();
      const u = users[id];
      if (!u) return false;
      if (u.password !== String(password)) return false;
      setSessionId(id);
      return true;
    },

    // 로그아웃
    logout() {
      setSessionId(null);
      return true;
    },

    // 회원가입
    signup({ id, password, realName = '', nickname = '', memo = '' }) {
      id = (id || '').trim();
      password = String(password || '');

      const v1 = validateId(id); if (!v1.ok) return { success:false, message: v1.msg };
      const v2 = validatePw(password); if (!v2.ok) return { success:false, message: v2.msg };

      const users = readUsers();
      if (users[id]) return { success:false, message:'이미 존재하는 아이디입니다.' };

      users[id] = { id, password, realName: realName.trim(), nickname: nickname.trim(), memo: memo.trim(), createdAt: Date.now() };
      writeUsers(users);
      return { success:true };
    },

    // (기존) 별명+이름+메모 일치 시 비번 재설정
    resetPasswordByHints({ nickname, realName, memo, newPassword }) {
      const v2 = validatePw(newPassword); if (!v2.ok) return { success:false, message: v2.msg };
      const users = readUsers();
      const ids = Object.keys(users);
      const foundId = ids.find(id => {
        const u = users[id];
        return (String(u.nickname||'') === String(nickname||'').trim()) &&
               (String(u.realName||'') === String(realName||'').trim()) &&
               (String(u.memo||'') === String(memo||'').trim());
      });
      if (!foundId) return { success:false, message:'일치하는 사용자를 찾을 수 없습니다.' };
      users[foundId].password = String(newPassword);
      writeUsers(users);
      return { success:true };
    },

    // (추가) 요청 반영: 아이디 + 실명으로 비밀번호 재설정
    resetPasswordByIdName({ id, realName, newPassword }) {
      id = (id || '').trim();
      realName = (realName || '').trim();
      const v2 = validatePw(newPassword); if (!v2.ok) return { success:false, message: v2.msg };

      const users = readUsers();
      const u = users[id];
      if (!u) return { success:false, message:'존재하지 않는 아이디입니다.' };
      if (String(u.realName || '') !== realName) {
        return { success:false, message:'실명이 일치하지 않습니다.' };
      }
      u.password = String(newPassword);
      writeUsers(users);
      return { success:true };
    }
  };

  global.auth = api;
  if (typeof window !== 'undefined') window.auth = api;

})(typeof globalThis !== 'undefined' ? globalThis : window);
