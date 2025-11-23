/* Simple IndexedDB helper (small) */
const IDB = (() => {
  const DB_NAME = 'streak-db-v1', DB_VER = 1;
  let dbp = null;
  function open(){
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject)=>{
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('users')) {
          const u = db.createObjectStore('users', { keyPath: 'username' });
        }
        if (!db.objectStoreNames.contains('tasks')) {
          const t = db.createObjectStore('tasks', { keyPath: 'id', autoIncrement:true });
          t.createIndex('by_user','user',{unique:false});
          t.createIndex('by_streak','streak',{unique:false});
        }
      };
      req.onsuccess = ()=>resolve(req.result);
      req.onerror = ()=>reject(req.error);
    });
    return dbp;
  }

  async function tx(storeNames, mode, callback){
    const db = await open();
    return new Promise((res, rej)=>{
      const tx = db.transaction(storeNames, mode);
      tx.oncomplete = ()=>{/*done*/};
      tx.onerror = ()=>rej(tx.error);
      callback(tx).then(res).catch(rej);
    });
  }

  return {
    async getUser(username){
      return tx(['users'],'readonly', t => new Promise((resolve, reject)=>{
        const s = t.objectStore('users').get(username);
        s.onsuccess = ()=>resolve(s.result);
        s.onerror = ()=>reject(s.error);
      }));
    },
    async putUser(obj){
      return tx(['users'],'readwrite', t => new Promise((resolve,reject)=>{
        const s = t.objectStore('users').put(obj);
        s.onsuccess = ()=>resolve(s.result);
        s.onerror = ()=>reject(s.error);
      }));
    },
    async addTask(task){
      return tx(['tasks'],'readwrite', t => new Promise((resolve,reject)=>{
        const s = t.objectStore('tasks').add(task);
        s.onsuccess = ()=>resolve(s.result);
        s.onerror = ()=>reject(s.error);
      }));
    },
    async updateTask(task){
      return tx(['tasks'],'readwrite', t => new Promise((resolve,reject)=>{
        const s = t.objectStore('tasks').put(task);
        s.onsuccess = ()=>resolve(s.result);
        s.onerror = ()=>reject(s.error);
      }));
    },
    async deleteTask(id){
      return tx(['tasks'],'readwrite', t => new Promise((resolve,reject)=>{
        const s = t.objectStore('tasks').delete(id);
        s.onsuccess = ()=>resolve(true);
        s.onerror = ()=>reject(s.error);
      }));
    },
    async getTasksByUser(user){
      return tx(['tasks'],'readonly', t => new Promise((resolve,reject)=>{
        const idx = t.objectStore('tasks').index('by_user');
        const req = idx.getAll(user);
        req.onsuccess = ()=>resolve(req.result);
        req.onerror = ()=>reject(req.error);
      }));
    },
    async getAllTasks(){
      return tx(['tasks'],'readonly', t => new Promise((resolve,reject)=>{
        const req = t.objectStore('tasks').getAll();
        req.onsuccess = ()=>resolve(req.result);
        req.onerror = ()=>reject(req.error);
      }));
    }
  };
})();
