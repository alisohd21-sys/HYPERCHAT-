import { 
    getAuth, 
    signInWithPopup, 
    signInWithRedirect, // أضفنا هذه
    getRedirectResult,  // وهذه للتحقق من النتيجة بعد العودة
    GoogleAuthProvider, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ... (بقية تعريفات Firebase والمغيرات)

const provider = new GoogleAuthProvider();

// التحقق من نتيجة إعادة التوجيه (هام جداً للأيفون)
getRedirectResult(auth).catch((error) => {
    console.error("خطأ في إعادة التوجيه:", error.message);
});

// دالة تسجيل الدخول بجوجل المعدلة
document.getElementById('btn-google').onclick = () => {
    // التحقق إذا كان الجهاز آيفون أو آيباد أو ماك (سفاري)
    const isApple = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);

    if (isApple) {
        // للأيفون: نستخدم إعادة التوجيه في نفس الصفحة لتجنب حظر النافذة المنبثقة
        signInWithRedirect(auth, provider);
    } else {
        // للأندرويد والكمبيوتر: نستخدم النافذة المنبثقة العادية
        signInWithPopup(auth, provider).catch(err => {
            // إذا فشلت النافذة المنبثقة لأي سبب، نستخدم الإعادة كخطة بديلة
            signInWithRedirect(auth, provider);
        });
    }
};
