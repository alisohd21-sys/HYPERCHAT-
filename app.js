import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDocs, addDoc, query, orderBy, onSnapshot, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// إعداداتك
const firebaseConfig = {
    apiKey: "AIzaSyBW1lS6QkWv4XKjswEykFcHlttlxZc5NHU",
    authDomain: "hyperchat-ff63f.firebaseapp.com",
    projectId: "hyperchat-ff63f",
    storageBucket: "hyperchat-ff63f.firebasestorage.app",
    messagingSenderId: "1024781406095",
    appId: "1:1024781406095:web:b5da5b813feb81f22f05fa"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// المتغيرات
let currentChatId = null;
let currentChatName = "";
let currentTab = "groups"; // 'groups' أو 'private'
let unsubscribeMessages = null;

// عناصر الواجهة
const authScreen = document.getElementById('auth-screen');
const mainApp = document.getElementById('main-app');
const sidebar = document.getElementById('sidebar');
const chatArea = document.getElementById('chat-area');
const listContainer = document.getElementById('list-container');
const messagesContainer = document.getElementById('messages-container');
const chatForm = document.getElementById('chat-form');

// --- نظام المصادقة (Authentication) --- //
onAuthStateChanged(auth, async (user) => {
    if (user) {
        authScreen.classList.add('hidden');
        mainApp.classList.remove('hidden');
        
        const displayName = user.displayName || user.email.split('@')[0];
        document.getElementById('current-user-name').innerText = displayName;

        // حفظ المستخدم في قاعدة البيانات ليظهر للآخرين في الخاص
        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            name: displayName,
            email: user.email,
            lastLogin: serverTimestamp()
        }, { merge: true });

        loadList();
    } else {
        authScreen.classList.remove('hidden');
        mainApp.classList.add('hidden');
    }
});

// الإيميل والباسورد
document.getElementById('btn-register').onclick = () => {
    const e = document.getElementById('email-input').value;
    const p = document.getElementById('password-input').value;
    createUserWithEmailAndPassword(auth, e, p).catch(err => alert("خطأ: " + err.message));
};
document.getElementById('btn-login').onclick = () => {
    const e = document.getElementById('email-input').value;
    const p = document.getElementById('password-input').value;
    signInWithEmailAndPassword(auth, e, p).catch(err => alert("بيانات غير صحيحة"));
};
// جوجل
document.getElementById('btn-google').onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
// الخروج
document.getElementById('btn-logout').onclick = () => signOut(auth);

// --- إدارة الواجهة والقوائم --- //
document.querySelectorAll('.tab').forEach(tab => {
    tab.onclick = (e) => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        currentTab = e.target.getAttribute('data-tab');
        loadList();
    };
});

async function loadList() {
    listContainer.innerHTML = "<p style='text-align:center; padding:20px'>جاري التحميل...</p>";
    
    if (currentTab === 'groups') {
        listContainer.innerHTML = `
            <div class="list-item" onclick="openChat('general', 'الكروب العام')">
                <div class="avatar" style="background:#28a745"><i class="fa-solid fa-users"></i></div>
                <div class="name">الكروب العام</div>
            </div>
            <div class="list-item" onclick="openChat('tech', 'قسم التقنية')">
                <div class="avatar" style="background:#17a2b8"><i class="fa-solid fa-laptop-code"></i></div>
                <div class="name">قسم التقنية</div>
            </div>
        `;
    } else {
        // جلب المستخدمين للمحادثات الخاصة
        const usersSnapshot = await getDocs(collection(db, "users"));
        listContainer.innerHTML = "";
        let hasUsers = false;
        
        usersSnapshot.forEach(doc => {
            const u = doc.data();
            // لا تظهر نفسك في القائمة
            if (u.uid !== auth.currentUser.uid) {
                hasUsers = true;
                // إنشاء معرف محادثة خاص بينك وبين هذا الشخص (يتم ترتيب الآيديات أبجدياً لضمان تطابق المعرف للطرفين)
                const privateChatId = [auth.currentUser.uid, u.uid].sort().join('_');
                
                const div = document.createElement('div');
                div.className = 'list-item';
                div.innerHTML = `
                    <div class="avatar"><i class="fa-solid fa-user"></i></div>
                    <div class="name">${u.name}</div>
                `;
                div.onclick = () => openChat(privateChatId, u.name);
                listContainer.appendChild(div);
            }
        });
        if(!hasUsers) listContainer.innerHTML = "<p style='text-align:center; padding:20px; color:#888'>لا يوجد مستخدمين آخرين مسجلين بعد.</p>";
    }
}

// --- فتح المحادثة --- //
window.openChat = (chatId, chatName) => {
    currentChatId = chatId;
    currentChatName = chatName;
    document.getElementById('chat-title').innerText = chatName;
    chatForm.classList.remove('hidden');

    // للموبايل: إخفاء القائمة وإظهار المحادثة
    if(window.innerWidth < 768) {
        sidebar.classList.add('hidden-mobile');
        chatArea.classList.remove('hidden-mobile');
    }

    loadMessages();
};

document.getElementById('btn-back').onclick = () => {
    sidebar.classList.remove('hidden-mobile');
    chatArea.classList.add('hidden-mobile');
};

// --- إرسال واستقبال الرسائل --- //
chatForm.onsubmit = async (e) => {
    e.preventDefault();
    const msgInput = document.getElementById('msg-input');
    const text = msgInput.value.trim();
    if (!text || !currentChatId) return;

    msgInput.value = ""; // مسح الحقل فوراً لسرعة الاستجابة

    await addDoc(collection(db, "messages"), {
        text: text,
        senderId: auth.currentUser.uid,
        senderName: auth.currentUser.displayName || auth.currentUser.email.split('@')[0],
        chatId: currentChatId,
        timestamp: serverTimestamp()
    });
};

function loadMessages() {
    if (unsubscribeMessages) unsubscribeMessages(); // إيقاف الاستماع للمحادثة السابقة

    const q = query(collection(db, "messages"), where("chatId", "==", currentChatId), orderBy("timestamp", "asc"));
    
    unsubscribeMessages = onSnapshot(q, (snapshot) => {
        messagesContainer.innerHTML = "";
        if (snapshot.empty) {
            messagesContainer.innerHTML = `<div class="empty-state">لا توجد رسائل سابقة. كن أول من يكتب!</div>`;
            return;
        }

        snapshot.forEach(doc => {
            const msg = doc.data();
            const isMe = msg.senderId === auth.currentUser.uid;
            
            // تنسيق الوقت
            let timeString = "";
            if (msg.timestamp) {
                const date = msg.timestamp.toDate();
                timeString = date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
            }

            const div = document.createElement('div');
            div.className = `message ${isMe ? 'msg-sent' : 'msg-received'}`;
            // إذا كانت رسالة مستلمة في كروب، أظهر اسم المرسل
            const nameHtml = (!isMe && currentTab === 'groups') ? `<span class="sender-name">${msg.senderName}</span>` : '';
            
            div.innerHTML = `
                ${nameHtml}
                <div class="text">${msg.text}</div>
                <span class="time">${timeString}</span>
            `;
            messagesContainer.appendChild(div);
        });
        // التمرير للأسفل تلقائياً
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
}
