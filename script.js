let user;

auth.onAuthStateChanged(async u => {
  if (u) {
    user = u;
    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("app-screen").classList.remove("hidden");
    document.getElementById("welcome").innerText = `👋 Welcome, ${u.displayName}`;
    loadTasks();
    loadLeaderboard();
  }
});

document.getElementById("googleLogin").onclick = () => {
  auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
};

function logout() {
  auth.signOut();
  location.reload();
}

async function addTask() {
  const name = document.getElementById("taskInput").value.trim();
  if (!name) return;

  await db.collection("tasks").add({
    user: user.uid,
    name,
    streak: 0,
    last: ""
  });

  loadTasks();
}

async function updateStreak(id, last, streak) {
  const today = new Date().toLocaleDateString();
  if (today !== last) streak++;

  await db.collection("tasks").doc(id).update({
    last: today,
    streak
  });

  new Notification("🔥 Streak Updated!", { body: `You're on a ${streak} day streak!` });

  loadTasks();
  loadLeaderboard();
}

async function loadTasks() {
  const res = await db.collection("tasks").where("user", "==", user.uid).get();
  const list = document.getElementById("taskList");
  list.innerHTML = "";

  res.forEach(doc => {
    const data = doc.data();
    list.innerHTML += `
      <div class="task">
        <h3>${data.name}</h3>
        <p>🔥 <span class="fire">${data.streak}</span> days</p>
        <button onclick="updateStreak('${doc.id}', '${data.last}', ${data.streak})">Mark Done</button>
      </div>
    `;
  });
}

async function loadLeaderboard() {
  const res = await db.collection("tasks")
    .orderBy("streak", "desc")
    .limit(5)
    .get();

  const lb = document.getElementById("leaderboard");
  lb.innerHTML = "";

  res.forEach(task => {
    lb.innerHTML += `<p>🔥 ${task.data().name}: <strong>${task.data().streak}</strong> days</p>`;
  });
}
