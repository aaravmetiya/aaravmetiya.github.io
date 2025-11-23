let currentUser = null;

async function signup() {
  const user = document.getElementById("username").value.trim();
  const pass = document.getElementById("password").value.trim();

  if (!user || !pass) return showMessage("❌ Fill all fields");

  const exists = await db.collection("users").doc(user).get();
  if (exists.exists) return showMessage("⚠ Username already exists");

  const hash = btoa(pass); // simple reversible encoding

  await db.collection("users").doc(user).set({
    password: hash,
    created: Date.now()
  });

  showMessage("✅ Account created — now login");
}

async function login() {
  const user = document.getElementById("username").value.trim();
  const pass = document.getElementById("password").value.trim();

  const record = await db.collection("users").doc(user).get();
  if (!record.exists) return showMessage("❌ User not found");

  if (record.data().password !== btoa(pass))
    return showMessage("❌ Incorrect password");

  currentUser = user;
  localStorage.setItem("loggedIn", user);

  document.getElementById("auth-screen").classList.add("hidden");
  document.getElementById("app-screen").classList.remove("hidden");
  document.getElementById("welcome").innerText = `👋 Welcome, ${user}!`;

  loadTasks();
  loadLeaderboard();
}

function logout() {
  localStorage.removeItem("loggedIn");
  location.reload();
}

async function addTask() {
  const task = document.getElementById("taskInput").value.trim();
  if (!task) return;

  await db.collection("tasks").add({
    user: currentUser,
    name: task,
    streak: 0,
    last: ""
  });

  loadTasks();
}

async function updateStreak(id, last, streak) {
  const today = new Date().toLocaleDateString();
  if (today !== last) streak++;

  await db.collection("tasks").doc(id).update({ last: today, streak });

  loadTasks();
  loadLeaderboard();
}

async function loadTasks() {
  const res = await db.collection("tasks").where("user", "==", currentUser).get();
  const list = document.getElementById("taskList");
  list.innerHTML = "";

  res.forEach(doc => {
    const t = doc.data();
    list.innerHTML += `
      <div class="task">
        <h3>${t.name}</h3>
        <p>🔥 <span class="fire">${t.streak}</span> days</p>
        <button onclick="updateStreak('${doc.id}', '${t.last}', ${t.streak})">Mark Done</button>
      </div>
    `;
  });
}

async function loadLeaderboard() {
  const res = await db.collection("tasks").orderBy("streak", "desc").limit(5).get();
  const lb = document.getElementById("leaderboard");
  lb.innerHTML = "";

  res.forEach(doc => {
    const t = doc.data();
    lb.innerHTML += `<p>🔥 ${t.name}: <strong>${t.streak}</strong> days</p>`;
  });
}

function showMessage(msg) {
  document.getElementById("authMessage").innerText = msg;
}

if (localStorage.getItem("loggedIn")) {
  document.getElementById("auth-screen").classList.add("hidden");
  document.getElementById("app-screen").classList.remove("hidden");
  currentUser = localStorage.getItem("loggedIn");
  document.getElementById("welcome").innerText = `👋 Welcome back, ${currentUser}`;
  loadTasks();
  loadLeaderboard();
}
