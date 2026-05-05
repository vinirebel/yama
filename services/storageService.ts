
import { User, UserRole, StampCard, LoyaltyConfig } from '../types';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { initializeApp, FirebaseApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  User as FirebaseUser
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  arrayUnion, 
  collection, 
  query, 
  where, 
  onSnapshot,
  getDocs,
  addDoc
} from "firebase/firestore";

// --------------------------------------------------------
// CONFIGURAÇÃO DO FIREBASE
// --------------------------------------------------------
// Substitua "API_KEY_AQUI" pelas suas credenciais reais do Firebase Console
const firebaseConfig = {
  apiKey: "API_KEY_AQUI",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto",
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
// --------------------------------------------------------

// Verify if config is set
const isFirebaseConfigured = firebaseConfig.apiKey !== "API_KEY_AQUI";

// --------------------------------------------------------
// CONFIGURAÇÃO DO SUPABASE
// --------------------------------------------------------
const supabaseUrl = import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const isSupabaseConfigured = !!supabaseUrl && supabaseUrl !== "https://your-project.supabase.co";

// --- INITIAL SEED DATA FOR DEMO MODE ---
const DEFAULT_CONFIG: LoyaltyConfig = {
  businessName: "Fideliza Demo",
  totalStamps: 10,
  rewardDescription: "Um prêmio especial",
  themeColor: "brand",
  logo: "" 
};

// --- INTERFACE DEFINITION ---
// Defines the shape of the service so both Firebase and Mock implement it
interface IStorageService {
  subscribeToAuth: (callback: (user: User | null) => void) => () => void;
  login: (email: string, pass: string) => Promise<any>;
  register: (name: string, email: string, phone: string, pass: string, role?: UserRole) => Promise<User>;
  logout: () => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  subscribeToConfig: (callback: (config: LoyaltyConfig) => void) => () => void;
  saveConfig: (config: LoyaltyConfig) => Promise<void>;
  getConfig: () => Promise<LoyaltyConfig>;
  subscribeToUsers: (callback: (users: User[]) => void) => () => void;
  subscribeToCards: (callback: (cards: StampCard[]) => void) => () => void;
  createActiveCard: (userId: string) => Promise<StampCard>;
  getOrCreateActiveCard: (userId: string) => Promise<StampCard>;
  addStamp: (userId: string, config: LoyaltyConfig) => Promise<void>;
  removeStamp: (userId: string) => Promise<void>;
  redeemCard: (userId: string) => Promise<void>;
  getUserByEmail: (email: string) => Promise<User | null>;
  resetPassword: (email: string) => Promise<void>;
}

// ========================================================
// IMPLEMENTATION A: FIREBASE SERVICE
// ========================================================
const createFirebaseService = (): IStorageService => {
  let app: FirebaseApp;
  let auth: any;
  let db: any;

  try {
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      db = getFirestore(app);
  } catch (e) {
      console.error("Firebase init failed", e);
  }

  return {
    subscribeToAuth: (callback) => {
      if (!auth) return () => {};
      return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
        if (firebaseUser) {
          try {
            const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
            if (userDoc.exists()) {
              callback(userDoc.data() as User);
            } else {
              callback({
                id: firebaseUser.uid,
                email: firebaseUser.email || '',
                name: 'Usuário',
                role: UserRole.CUSTOMER
              });
            }
          } catch (e) { console.error(e); callback(null); }
        } else {
          callback(null);
        }
      });
    },

    login: async (email, pass) => {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      return cred.user;
    },

    register: async (name, email, phone, pass, role = UserRole.CUSTOMER) => {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      const uid = cred.user.uid;
      const newUser: User = { id: uid, name, email, phone, role };
      await setDoc(doc(db, "users", uid), newUser);
      if (role === UserRole.CUSTOMER) {
        await createActiveCardFirebase(db, uid);
      }
      return newUser;
    },

    logout: async () => await signOut(auth),

    deleteUser: async (userId) => {
       await setDoc(doc(db, "users", userId), { role: 'DELETED' }, { merge: true });
    },

    subscribeToConfig: (callback) => {
      return onSnapshot(doc(db, "config", "main"), (doc) => {
        if (doc.exists()) callback(doc.data() as LoyaltyConfig);
        else {
          setDoc(doc(db, "config", "main"), DEFAULT_CONFIG);
          callback(DEFAULT_CONFIG);
        }
      });
    },

    saveConfig: async (config) => await setDoc(doc(db, "config", "main"), config),

    getConfig: async () => {
       const snap = await getDoc(doc(db, "config", "main"));
       return snap.exists() ? snap.data() as LoyaltyConfig : DEFAULT_CONFIG;
    },

    subscribeToUsers: (callback) => {
      const q = query(collection(db, "users"));
      return onSnapshot(q, (snapshot) => {
        const users: User[] = [];
        snapshot.forEach(doc => users.push(doc.data() as User));
        callback(users);
      });
    },

    subscribeToCards: (callback) => {
      const q = query(collection(db, "cards"));
      return onSnapshot(q, (snapshot) => {
        const cards: StampCard[] = [];
        snapshot.forEach(doc => cards.push(doc.data() as StampCard));
        callback(cards);
      });
    },

    createActiveCard: (userId) => createActiveCardFirebase(db, userId),

    getOrCreateActiveCard: async (userId) => {
      const q = query(collection(db, "cards"), where("userId", "==", userId), where("redeemed", "==", false));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) return snapshot.docs[0].data() as StampCard;
      return createActiveCardFirebase(db, userId);
    },

    addStamp: async (userId, config) => {
      const q = query(collection(db, "cards"), where("userId", "==", userId), where("redeemed", "==", false));
      const snapshot = await getDocs(q);
      let card: StampCard;
      if (snapshot.empty) card = await createActiveCardFirebase(db, userId);
      else card = snapshot.docs[0].data() as StampCard;

      if (card.currentStamps < config.totalStamps) {
         const updates: any = {
             currentStamps: card.currentStamps + 1,
             history: arrayUnion({ date: new Date().toISOString(), action: 'STAMP' })
         };
         if (card.currentStamps + 1 >= config.totalStamps) updates.completed = true;
         await updateDoc(doc(db, "cards", card.id), updates);
      }
    },

    removeStamp: async (userId) => {
      const q = query(collection(db, "cards"), where("userId", "==", userId), where("redeemed", "==", false));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
          const card = snapshot.docs[0].data() as StampCard;
          if (card.currentStamps > 0) {
              await updateDoc(doc(db, "cards", card.id), {
                  currentStamps: card.currentStamps - 1,
                  completed: false,
                  history: arrayUnion({ date: new Date().toISOString(), action: 'REMOVED' })
              });
          }
      }
    },

    redeemCard: async (userId) => {
      const q = query(collection(db, "cards"), where("userId", "==", userId), where("completed", "==", true), where("redeemed", "==", false));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
          const card = snapshot.docs[0].data() as StampCard;
          await updateDoc(doc(db, "cards", card.id), {
              redeemed: true,
              history: arrayUnion({ date: new Date().toISOString(), action: 'REDEEM' })
          });
          await createActiveCardFirebase(db, userId);
      }
    },

    getUserByEmail: async (email) => {
       const q = query(collection(db, "users"), where("email", "==", email));
       const snap = await getDocs(q);
       return !snap.empty ? snap.docs[0].data() as User : null;
    },

    resetPassword: async (email) => {
      if (!auth) return;
      await sendPasswordResetEmail(auth, email);
    }
  };
};

// Helper for Firebase
const createActiveCardFirebase = async (db: any, userId: string): Promise<StampCard> => {
  const newCard: StampCard = {
    id: `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId,
    currentStamps: 0,
    completed: false,
    redeemed: false,
    history: [{ date: new Date().toISOString(), action: 'CREATED' }]
  };
  await setDoc(doc(db, "cards", newCard.id), newCard);
  return newCard;
};

// ========================================================
// IMPLEMENTATION C: SUPABASE SERVICE
// ========================================================
const createSupabaseService = (): IStorageService => {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  return {
    subscribeToAuth: (callback) => {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          if (profile) {
            callback({
              id: profile.id,
              name: profile.name,
              email: profile.email,
              role: profile.role as UserRole,
              phone: profile.phone
            });
          } else {
            callback({
              id: session.user.id,
              email: session.user.email || '',
              name: session.user.user_metadata?.name || 'Usuário',
              role: (session.user.user_metadata?.role as UserRole) || UserRole.CUSTOMER
            });
          }
        } else {
          callback(null);
        }
      });
      return () => subscription.unsubscribe();
    },

    login: async (email, pass) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) throw error;
      return data.user;
    },

    register: async (name, email, phone, pass, role = UserRole.CUSTOMER) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: {
          data: { name, phone, role }
        }
      });
      if (error) throw error;
      if (!data.user) throw new Error("Erro ao criar usuário");

      const newUser: User = { id: data.user.id, name, email, phone, role };
      // O trigger no banco vai criar o registro em 'profiles'
      
      if (role === UserRole.CUSTOMER) {
        await createActiveCardSupabase(supabase, data.user.id);
      }
      return newUser;
    },

    logout: async () => {
      await supabase.auth.signOut();
    },

    deleteUser: async (userId) => {
       // Em apps reais, deletar do auth.users requer admin privileges
       // Aqui simulamos marcando role como deletado no profile
       await supabase.from('profiles').update({ role: 'DELETED' }).eq('id', userId);
    },

    subscribeToConfig: (callback) => {
      supabase
        .from('config')
        .select('*')
        .eq('id', 'main')
        .single()
        .then(({ data }) => {
          if (data) callback(data as LoyaltyConfig);
          else {
            supabase.from('config').insert(DEFAULT_CONFIG).then(() => callback(DEFAULT_CONFIG));
          }
        });

      const channel = supabase
        .channel('schema-db-changes')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'config' }, payload => {
           callback(payload.new as LoyaltyConfig);
        })
        .subscribe();
      
      return () => { supabase.removeChannel(channel); };
    },

    saveConfig: async (config) => {
      const { error } = await supabase.from('config').upsert({ id: 'main', ...config });
      if (error) throw error;
    },

    getConfig: async () => {
      const { data } = await supabase.from('config').select('*').eq('id', 'main').single();
      return (data as LoyaltyConfig) || DEFAULT_CONFIG;
    },

    subscribeToUsers: (callback) => {
      supabase.from('profiles').select('*').then(({ data }) => callback(data || []));
      
      const channel = supabase
        .channel('profiles-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
           supabase.from('profiles').select('*').then(({ data }) => callback(data || []));
        })
        .subscribe();
      
      return () => { supabase.removeChannel(channel); };
    },

    subscribeToCards: (callback) => {
      supabase.from('cards').select('*').then(({ data }) => callback(data || []));
      
      const channel = supabase
        .channel('cards-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cards' }, () => {
           supabase.from('cards').select('*').then(({ data }) => callback(data || []));
        })
        .subscribe();
      
      return () => { supabase.removeChannel(channel); };
    },

    createActiveCard: (userId) => createActiveCardSupabase(supabase, userId),

    getOrCreateActiveCard: async (userId) => {
      const { data } = await supabase
        .from('cards')
        .select('*')
        .eq('userId', userId)
        .eq('redeemed', false)
        .single();
      
      if (data) return data as unknown as StampCard;
      return createActiveCardSupabase(supabase, userId);
    },

    addStamp: async (userId, config) => {
      const { data: card } = await supabase
        .from('cards')
        .select('*')
        .eq('user_id', userId)
        .eq('redeemed', false)
        .single();
      
      let activeCard = card as unknown as StampCard;
      if (!activeCard) activeCard = await createActiveCardSupabase(supabase, userId);

      if (activeCard.currentStamps < config.totalStamps) {
         const newStamps = activeCard.currentStamps + 1;
         const history = [...activeCard.history, { date: new Date().toISOString(), action: 'STAMP' }];
         const completed = newStamps >= config.totalStamps;
         
         await supabase
           .from('cards')
           .update({ current_stamps: newStamps, history, completed, updated_at: new Date().toISOString() })
           .eq('id', activeCard.id);
      }
    },

    removeStamp: async (userId) => {
      const { data: card } = await supabase
        .from('cards')
        .select('*')
        .eq('user_id', userId)
        .eq('redeemed', false)
        .single();
      
      if (card) {
          const activeCard = card as unknown as StampCard;
          if (activeCard.currentStamps > 0) {
              const newStamps = activeCard.currentStamps - 1;
              const history = [...activeCard.history, { date: new Date().toISOString(), action: 'REMOVED' }];
              await supabase
                .from('cards')
                .update({ current_stamps: newStamps, history, completed: false, updated_at: new Date().toISOString() })
                .eq('id', activeCard.id);
          }
      }
    },

    redeemCard: async (userId) => {
      const { data: card } = await supabase
        .from('cards')
        .select('*')
        .eq('user_id', userId)
        .eq('completed', true)
        .eq('redeemed', false)
        .single();
      
      if (card) {
          const activeCard = card as unknown as StampCard;
          const history = [...activeCard.history, { date: new Date().toISOString(), action: 'REDEEM' }];
          await supabase
            .from('cards')
            .update({ redeemed: true, history, updated_at: new Date().toISOString() })
            .eq('id', activeCard.id);
          
          await createActiveCardSupabase(supabase, userId);
      }
    },

    getUserByEmail: async (email) => {
       const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .single();
       return data as User | null;
    },

    resetPassword: async (email) => {
      await supabase.auth.resetPasswordForEmail(email);
    }
  };
};

const createActiveCardSupabase = async (supabase: SupabaseClient, userId: string): Promise<StampCard> => {
  const newCard = {
    user_id: userId,
    current_stamps: 0,
    completed: false,
    redeemed: false,
    history: [{ date: new Date().toISOString(), action: 'CREATED' }]
  };
  const { data, error } = await supabase.from('cards').insert(newCard).select().single();
  if (error) throw error;
  
  // Map back to camelCase for the frontend if needed (ou ajustar o card para snake_case no banco)
  return {
    id: data.id,
    userId: data.user_id,
    currentStamps: data.current_stamps,
    completed: data.completed,
    redeemed: data.redeemed,
    history: data.history
  };
};

// ========================================================
// IMPLEMENTATION B: MOCK SERVICE (LOCAL STORAGE)
// ========================================================
const createMockService = (): IStorageService => {
  console.warn("⚠️ MODO DEMONSTRAÇÃO ATIVO: Usando LocalStorage. Configure o Firebase para persistência real.");
  
  // Storage Keys
  const K_USERS = 'fideliza_users';
  const K_CARDS = 'fideliza_cards';
  const K_CONFIG = 'fideliza_config';
  const K_SESSION = 'fideliza_session';

  // Helpers
  const getLS = <T>(key: string, def: T): T => {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : def;
  };
  const setLS = (key: string, val: any) => localStorage.setItem(key, JSON.stringify(val));

  // Initialize Defaults
  if (!localStorage.getItem(K_CONFIG)) setLS(K_CONFIG, DEFAULT_CONFIG);
  
  // Seed default admin if no admin exists
  const existingUsers = getLS<any[]>(K_USERS, []);
  if (existingUsers.length === 0 || !existingUsers.some(u => u.role === UserRole.ADMIN)) {
    const defaultAdmin = { 
      id: 'admin_demo', 
      name: 'Lojista Admin', 
      email: 'admin@fideliza.com', 
      phone: '(11) 99999-9999', 
      role: UserRole.ADMIN, 
      password: 'admin' 
    };
    
    // Avoid duplicates if email already exists but role is different (unlikely in demo)
    if (!existingUsers.some(u => u.email.toLowerCase() === defaultAdmin.email.toLowerCase())) {
        existingUsers.push(defaultAdmin);
        setLS(K_USERS, existingUsers);
    }
  }
  
  if (!localStorage.getItem(K_CARDS)) setLS(K_CARDS, []);

  return {
    subscribeToAuth: (callback) => {
      const checkSession = () => {
        const uid = localStorage.getItem(K_SESSION);
        if (uid) {
           const users = getLS<any[]>(K_USERS, []);
           const user = users.find(u => u.id === uid);
           callback(user || null);
        } else {
           callback(null);
        }
      };
      checkSession();
      // Simple polling for session changes in other tabs
      const interval = setInterval(checkSession, 1000);
      return () => clearInterval(interval);
    },

    login: async (email, pass) => {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          const users = getLS<any[]>(K_USERS, []);
          // In mock, we store password in the user object (unsafe for real apps, ok for mock)
          const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === pass);
          if (user) {
            localStorage.setItem(K_SESSION, user.id);
            resolve(user);
          } else {
            reject({ 
                code: 'auth/invalid-login-credentials', 
                message: 'Invalid login credentials' 
            });
          }
        }, 500);
      });
    },

    register: async (name, email, phone, pass, role = UserRole.CUSTOMER) => {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          const users = getLS<any[]>(K_USERS, []);
          if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
            reject({ code: 'auth/email-already-in-use' });
            return;
          }
          const newUser = { id: `user_${Date.now()}`, name, email, phone, role, password: pass };
          users.push(newUser);
          setLS(K_USERS, users);
          localStorage.setItem(K_SESSION, newUser.id);
          
          if (role === UserRole.CUSTOMER) {
             const cards = getLS<StampCard[]>(K_CARDS, []);
             const newCard: StampCard = {
                id: `card_${Date.now()}`,
                userId: newUser.id,
                currentStamps: 0,
                completed: false,
                redeemed: false,
                history: [{ date: new Date().toISOString(), action: 'CREATED' }]
             };
             cards.push(newCard);
             setLS(K_CARDS, cards);
          }
          
          resolve(newUser as unknown as User);
        }, 500);
      });
    },

    logout: async () => {
      localStorage.removeItem(K_SESSION);
    },

    deleteUser: async (userId) => {
       const users = getLS<User[]>(K_USERS, []);
       setLS(K_USERS, users.filter(u => u.id !== userId));
    },

    subscribeToConfig: (callback) => {
      const interval = setInterval(() => {
         callback(getLS(K_CONFIG, DEFAULT_CONFIG));
      }, 1000);
      callback(getLS(K_CONFIG, DEFAULT_CONFIG));
      return () => clearInterval(interval);
    },

    saveConfig: async (config) => {
       setLS(K_CONFIG, config);
    },

    getConfig: async () => getLS(K_CONFIG, DEFAULT_CONFIG),

    subscribeToUsers: (callback) => {
      const interval = setInterval(() => {
         callback(getLS(K_USERS, []));
      }, 1000);
      callback(getLS(K_USERS, []));
      return () => clearInterval(interval);
    },

    subscribeToCards: (callback) => {
      const interval = setInterval(() => {
         callback(getLS(K_CARDS, []));
      }, 1000);
      callback(getLS(K_CARDS, []));
      return () => clearInterval(interval);
    },

    createActiveCard: async (userId) => {
      const cards = getLS<StampCard[]>(K_CARDS, []);
      const newCard: StampCard = {
        id: `card_${Date.now()}`,
        userId,
        currentStamps: 0,
        completed: false,
        redeemed: false,
        history: [{ date: new Date().toISOString(), action: 'CREATED' }]
      };
      cards.push(newCard);
      setLS(K_CARDS, cards);
      return newCard;
    },

    getOrCreateActiveCard: async (userId) => {
      const cards = getLS<StampCard[]>(K_CARDS, []);
      const existing = cards.find(c => c.userId === userId && !c.redeemed);
      if (existing) return existing;
      
      // Call create internally
      const newCard: StampCard = {
        id: `card_${Date.now()}`,
        userId,
        currentStamps: 0,
        completed: false,
        redeemed: false,
        history: [{ date: new Date().toISOString(), action: 'CREATED' }]
      };
      cards.push(newCard);
      setLS(K_CARDS, cards);
      return newCard;
    },

    addStamp: async (userId, config) => {
       const cards = getLS<StampCard[]>(K_CARDS, []);
       const cardIdx = cards.findIndex(c => c.userId === userId && !c.redeemed);
       
       if (cardIdx > -1) {
          const card = cards[cardIdx];
          if (card.currentStamps < config.totalStamps) {
             card.currentStamps += 1;
             card.history.push({ date: new Date().toISOString(), action: 'STAMP' });
             if (card.currentStamps >= config.totalStamps) {
                card.completed = true;
             }
             cards[cardIdx] = card;
             setLS(K_CARDS, cards);
          }
       } else {
          // Create and stamp
          const newCard: StampCard = {
            id: `card_${Date.now()}`,
            userId,
            currentStamps: 1,
            completed: config.totalStamps === 1,
            redeemed: false,
            history: [{ date: new Date().toISOString(), action: 'CREATED' }, { date: new Date().toISOString(), action: 'STAMP' }]
          };
          cards.push(newCard);
          setLS(K_CARDS, cards);
       }
    },

    removeStamp: async (userId) => {
       const cards = getLS<StampCard[]>(K_CARDS, []);
       const cardIdx = cards.findIndex(c => c.userId === userId && !c.redeemed);
       if (cardIdx > -1) {
          const card = cards[cardIdx];
          if (card.currentStamps > 0) {
              card.currentStamps -= 1;
              card.completed = false;
              card.history.push({ date: new Date().toISOString(), action: 'REMOVED' });
              cards[cardIdx] = card;
              setLS(K_CARDS, cards);
          }
       }
    },

    redeemCard: async (userId) => {
       const cards = getLS<StampCard[]>(K_CARDS, []);
       const cardIdx = cards.findIndex(c => c.userId === userId && !c.redeemed && c.completed);
       
       if (cardIdx > -1) {
           cards[cardIdx].redeemed = true;
           cards[cardIdx].history.push({ date: new Date().toISOString(), action: 'REDEEM' });
           
           // Generate new
           const newCard: StampCard = {
                id: `card_${Date.now()}_new`,
                userId,
                currentStamps: 0,
                completed: false,
                redeemed: false,
                history: [{ date: new Date().toISOString(), action: 'CREATED' }]
           };
           cards.push(newCard);
           setLS(K_CARDS, cards);
       }
    },

    getUserByEmail: async (email) => {
       const users = getLS<User[]>(K_USERS, []);
       return users.find(u => u.email === email) || null;
    },

    resetPassword: async (email) => {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          const users = getLS<User[]>(K_USERS, []);
          const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
          if (user) {
             resolve();
          } else {
             reject(new Error('User not found'));
          }
        }, 500);
      });
    }
  };
};

// ========================================================
// EXPORT based on configuration
// ========================================================

export const StorageService = isSupabaseConfigured 
  ? createSupabaseService() 
  : (isFirebaseConfigured ? createFirebaseService() : createMockService());
