import { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase.js";
import { C, F } from "./utils/theme.js";

import Header  from "./components/Header.jsx";
import Login   from "./pages/Login.jsx";
import Submit  from "./pages/Submit.jsx";
import Library from "./pages/Library.jsx";
import Admin   from "./pages/Admin.jsx";

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || "Trisha.mahajan@adraindia.org";

export default function App() {
  const [user,    setUser]    = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        if (!firebaseUser.email?.toLowerCase().endsWith("@adraindia.org")) {
          await auth.signOut(); setUser(null); setLoading(false); return;
        }
        setUser(firebaseUser);
        try {
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          const adminFlag = firebaseUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
            || (userDoc.exists() && userDoc.data().isAdmin === true);
          setIsAdmin(adminFlag);
        } catch {
          setIsAdmin(firebaseUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
        }
        if (window.location.pathname === "/" || window.location.pathname === "") {
          navigate("/submit");
        }
      } else {
        setUser(null); setIsAdmin(false);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:C.greyLight }}>
      <div style={{ fontFamily:F.head, fontSize:14, color:C.green, letterSpacing:"0.1em" }}>LOADING…</div>
    </div>
  );

  if (!user) return <Login />;

  return (
    <div style={{ minHeight:"100vh", background:C.greyLight }}>
      <Header user={user} isAdmin={isAdmin} />
      <Routes>
        <Route path="/"        element={<Navigate to="/submit" replace />} />
        <Route path="/submit"  element={<Submit  user={user} />} />
        <Route path="/library" element={<Library user={user} />} />
        <Route path="/admin"   element={isAdmin ? <Admin user={user} /> : <Navigate to="/submit" replace />} />
        <Route path="*"        element={<Navigate to="/submit" replace />} />
      </Routes>
      <div style={{ background:C.green, color:"rgba(255,255,255,0.55)", textAlign:"center", padding:"12px 24px", fontFamily:F.head, fontSize:10, letterSpacing:"0.1em" }}>
        ADRA INDIA · CONTENT HUB · INTERNAL TOOL · ADRAINDIA.ORG
      </div>
    </div>
  );
}
