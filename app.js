// App logic: local gamified PWA using IndexedDB (IDB helper above)

const $ = id => document.getElementById(id);
let currentUser = null;

/* ---------- Utilities ---------- */
async function hashPassword(password){
  const enc = new TextEncoder().encode(password);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

function xpToLevel(xp){
  // simple leveling curve: level increases every 100 XP approx
  return Math.floor(Math.sqrt(xp/50)) + 1;
}

function rewardXP(base=20){
  return base; // can adjust or add multipliers
}

function floatXP(x,y,text){
  const fx = document.getElementById('fx-layer');
  const el = document.createElement('div');
  el.className = 'xp-burst';
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.innerText = text;
  fx.appendChild(el);
  setTimeout(()=>el.remove(), 1000);
}

/* ---------- Avatar assets (you can replace with files in icons/) ---------- */
const AVATARS = [
  'icons/avatar1.svg',
  'icons/avatar2.svg'
];

/* ---------- UI binding ---------- */
function show(el){ el.classList.remove('hidden'); }
function hide(el){ el.classList.add('hidden'); }

/* ---------- AUTH UI ---------- */
function initAuthUI(){
  // avatar list
  const list = $('avatar-list');
  AVATARS.forEach((src, idx)=>{
    const img = document.createElement('img');
    img.src = src;
    img.className = 'avatar-sel';
    img.dataset.idx = idx;
    if (idx===0) img.classList.add('selected');
    img.onclick = () => {
      list.querySelectorAll('.avatar-sel').forEach(a=>a.classList.remove('selected'));
      img.classList.add('selected');
    };
    list.appendChild(img);
  });

  $('show-signup').onclick = ()=>{ hide($('login-form')); show($('signup-form')); };
  $('show-login').onclick = ()=>{ hide($('signup-form')); show($('login-form')); };

  $('btn-signup').onclick = async ()=>{
    const username = $('signup-username').value.trim();
    const password = $('signup-password').value;
    const avatarIdx = parseInt(document.querySelector('.avatar-sel.selected').dataset.idx);
    if (!username || !password) { $('signup-msg').innerText = 'Enter username & password'; return; }
    const exists = await IDB.getUser(username);
    if (exists){ $('signup-msg').innerText = 'Username taken'; return; }
    const hash = await hashPassword(password);
    const userObj = {
      username,
      passwordHash: hash,
      avatar: AVATARS[avatarIdx],
      xp: 0,
      createdAt: Date.now()
    };
    await IDB.putUser(userObj);
    $('signup-msg').innerText = 'Account created. You can login now.';
    // auto-switch to login
    setTimeout(()=>{ $('show-login').click(); }, 800);
  };

  $('btn-login').onclick = async ()=>{
    const username = $('login-username').value.trim();
    const password = $('login-password').value;
    if (!username || !password){ $('login-msg').innerText = 'Enter credentials'; return; }
    const record = await IDB.getUser(username);
    if (!record){ $('login-msg').innerText = 'User not found'; return; }
    const hash = await hashPassword(password);
    if (hash !== record.passwordHash){ $('login-msg').innerText = 'Incorrect password'; return; }
    // success
    currentUser = username;
    localStorage.setItem('streak_user', currentUser);
    $('login-msg').innerText = '';
    startAppForUser(record);
  };
}

/* ---------- APP UI ---------- */
async function startAppForUser(userRecord){
  // hide auth show main
  hide($('auth'));
  show($('main'));
  // render header
  $('user-avatar').src = userRecord.avatar || AVATARS[0];
  updateHeader(userRecord);
  // bind buttons
  $('btn-logout').onclick = ()=>{ localStorage.removeItem('streak_user'); location.reload(); };
  $('btn-add-task').onclick = addTask;
  $('btn-sync').onclick = ()=>{ refreshAll(); };

  // load tasks
  refreshAll();
}

async function updateHeader(userRecord){
  $('user-greet').innerText = `✦ ${userRecord.username}`;
  $('user-level').innerText = `Level ${xpToLevel(userRecord.xp)} • XP: ${userRecord.xp}`;
}

/* ---------- Task management ---------- */
async function addTask(){
  const name = $('task-name').value.trim();
  if (!name) return;
  const task = { user: currentUser, name, streak: 0, last: '', created: Date.now() };
  await IDB.addTask(task);
  $('task-name').value = '';
  refreshAll();
}

async function markDoneTask(task){
  const today = new Date().toLocaleDateString();
  let gained = 0;
  if (task.last === today) {
    // already done
    return;
  } else {
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString();
    if (task.last === yesterday) {
      task.streak = (task.streak || 0) + 1;
      gained = rewardXP(25);
    } else {
      task.streak = 1;
      gained = rewardXP(15);
    }
    task.last = today;
    await IDB.updateTask(task);

    // award XP to user
    const userRec = await IDB.getUser(currentUser);
    userRec.xp = (userRec.xp || 0) + gained;
    await IDB.putUser(userRec);
    updateHeader(userRec);

    // animate XP burst near cursor center of task element
    // find task element position
    const taskEl = document.querySelector(`[data-taskid='${task.id}']`);
    if (taskEl){
      const rect = taskEl.getBoundingClientRect();
      const x = rect.left + rect.width/2;
      const y = rect.top + rect.height/2;
      floatXP(x,y, `+${gained} XP`);
    }
    // small level up check
    const newLevel = xpToLevel(userRec.xp);
    // optional level up effect
    if (newLevel > xpToLevel(userRec.xp - gained)){
      floatXP(window.innerWidth/2,100, `LEVEL ${newLevel}!`);
    }
  }
  refreshAll();
}

async function deleteTaskById(id){
  await IDB.deleteTask(id);
  refreshAll();
}

/* ---------- render lists ---------- */
async function refreshAll(){
  const userRec = await IDB.getUser(currentUser);
  updateHeader(userRec);

  // tasks
  const tasks = await IDB.getTasksByUser(currentUser);
  const tasksDiv = $('tasks');
  tasksDiv.innerHTML = '';
  tasks.sort((a,b)=> b.streak - a.streak);
  tasks.forEach(t=>{
    const el = document.createElement('div'); el.className = 'task'; el.dataset.taskid = t.id;
    el.innerHTML = `
      <div class="meta">
        <div>
          <strong>${t.name}</strong>
          <div style="color:var(--muted);font-size:12px">Last: ${t.last || 'never'}</div>
        </div>
      </div>
      <div>
        <span class="fire">🔥 ${t.streak || 0}</span>
        <div style="margin-top:8px"">
          <button class="btn-mark">Mark</button>
          <button class="btn-del" style="margin-left:6px">Delete</button>
        </div>
      </div>
    `;
    tasksDiv.appendChild(el);
    el.querySelector('.btn-mark').onclick = ()=> markDoneTask(t);
    el.querySelector('.btn-del').onclick = ()=> { if(confirm('Delete this task?')) deleteTaskById(t.id); };
  });

  // leaderboard (top users by xp)
  const allTasks = await IDB.getAllTasks();
  const usersMap = {};
  allTasks.forEach(t => {
    if(!usersMap[t.user]) usersMap[t.user] = { xp:0, name: t.user };
    usersMap[t.user].xp += (t.streak || 0)*5; // local composite score if needed
  });
  // also include user XP stored in users table
  const lbUsers = [];
  // fetch users: iterate index directly by opening IDB (quick hack)
  // We will expose a small helper to fetch all users using a transaction
  const db = await (async ()=>{
    return new Promise((res,rej)=>{
      const r = indexedDB.open('streak-db-v1');
      r.onsuccess = ()=>res(r.result);
    });
  })();
  const tx = db.transaction('users','readonly');
  const store = tx.objectStore('users');
  const req = store.getAll();
  req.onsuccess = ()=>{
    req.result.forEach(u=>{
      lbUsers.push({username:u.username, xp: u.xp || 0, avatar:u.avatar});
    });
    lbUsers.sort((a,b)=> b.xp - a.xp);
    const lb = $('leaderboard');
    lb.innerHTML = lbUsers.slice(0,8).map(u=>`<p><img src="${u.avatar}" style="width:28px;height:28px;border-radius:6px;margin-right:8px;vertical-align:middle" /> <strong>${u.username}</strong> — XP: ${u.xp}</p>`).join('');
  };
}

/* ---------- bootstrap ---------- */
(async ()=>{
  initAuthUI();
  // auto-login if stored
  const stored = localStorage.getItem('streak_user');
  if (stored){
    const rec = await IDB.getUser(stored);
    if (rec){ currentUser = stored; startAppForUser(rec); }
    else localStorage.removeItem('streak_user');
  }
})();
