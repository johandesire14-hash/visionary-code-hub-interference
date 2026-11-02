import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, LockKeyhole, ShieldCheck, Smartphone } from "lucide-react";
import {
  auth,
  EmailAuthProvider,
  multiFactor,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  updatePassword,
} from "../../services/firebase";

interface SecuritySettingsPanelProps {
  email?: string | null;
}

const errorMessage = (error: any) => {
  if (error?.code === "auth/requires-recent-login") return "Reconnectez-vous avant de modifier ce réglage.";
  if (error?.code === "auth/weak-password") return "Le nouveau mot de passe doit contenir au moins 6 caractères.";
  if (error?.code === "auth/wrong-password" || error?.code === "auth/invalid-credential") return "Le mot de passe actuel est incorrect.";
  if (error?.code === "auth/operation-not-allowed") return "Cette option de sécurité n’est pas disponible pour le moment.";
  if (error?.code === "auth/invalid-phone-number") return "Le numéro de téléphone n’est pas valide.";
  if (error?.code === "auth/invalid-verification-code") return "Le code reçu est incorrect.";
  return "Une erreur est survenue. Réessayez.";
};

export const SecuritySettingsPanel: React.FC<SecuritySettingsPanelProps> = ({ email }) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [isMfaSending, setIsMfaSending] = useState(false);
  const [isMfaSaving, setIsMfaSaving] = useState(false);
  const [mfaActive, setMfaActive] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  const refreshMfaStatus = () => {
    const currentUser = auth?.currentUser;
    setMfaActive(Boolean(currentUser && multiFactor(currentUser).enrolledFactors.length > 0));
  };

  useEffect(() => {
    refreshMfaStatus();
    return () => {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    };
  }, []);

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (!auth?.currentUser || !email) return setMessage({ type: "error", text: "Aucun compte connecté." });
    if (newPassword.length < 6) return setMessage({ type: "error", text: "Le nouveau mot de passe doit contenir au moins 6 caractères." });
    if (newPassword !== confirmPassword) return setMessage({ type: "error", text: "Les deux nouveaux mots de passe ne correspondent pas." });
    setIsPasswordSaving(true);
    try {
      const credential = EmailAuthProvider.credential(email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage({ type: "success", text: "Votre mot de passe a été modifié." });
    } catch (error) {
      setMessage({ type: "error", text: errorMessage(error) });
    } finally {
      setIsPasswordSaving(false);
    }
  };

  const sendMfaCode = async () => {
    setMessage(null);
    const currentUser = auth?.currentUser;
    const currentAuth = auth;
    if (!currentUser || !currentAuth) return setMessage({ type: "error", text: "Aucun compte connecté." });
    if (!phoneNumber.trim()) return setMessage({ type: "error", text: "Saisissez un numéro avec son indicatif, par exemple +225..." });
    setIsMfaSending(true);
    try {
      recaptchaRef.current?.clear();
      recaptchaRef.current = new RecaptchaVerifier(currentAuth, "mfa-recaptcha", { size: "invisible" });
      const session = await multiFactor(currentUser).getSession();
      const provider = new PhoneAuthProvider(currentAuth);
      const id = await provider.verifyPhoneNumber({ phoneNumber: phoneNumber.trim(), session }, recaptchaRef.current);
      setVerificationId(id);
      setMessage({ type: "success", text: "Un code de vérification a été envoyé par SMS." });
    } catch (error) {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
      setMessage({ type: "error", text: errorMessage(error) });
    } finally {
      setIsMfaSending(false);
    }
  };

  const activateMfa = async (event: React.FormEvent) => {
    event.preventDefault();
    const currentUser = auth?.currentUser;
    if (!currentUser || !verificationId || !verificationCode.trim()) return;
    setIsMfaSaving(true);
    setMessage(null);
    try {
      const credential = PhoneAuthProvider.credential(verificationId, verificationCode.trim());
      const assertion = PhoneMultiFactorGenerator.assertion(credential);
      await multiFactor(currentUser).enroll(assertion, "Téléphone principal");
      setVerificationId(null);
      setVerificationCode("");
      setMfaActive(true);
      setMessage({ type: "success", text: "L’authentification à deux facteurs est maintenant active." });
    } catch (error) {
      setMessage({ type: "error", text: errorMessage(error) });
    } finally {
      setIsMfaSaving(false);
    }
  };

  return (
    <div className="space-y-4 text-xs">
      <div id="mfa-recaptcha" />
      {message && (
        <div className={`flex items-start gap-2 rounded-xl border p-3 ${message.type === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-rose-500/30 bg-rose-500/10 text-rose-300"}`}>
          {message.type === "success" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <AlertCircle className="mt-0.5 size-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      <form onSubmit={changePassword} className="rounded-xl border border-white/[0.08] bg-[#14161b] p-4 space-y-3">
        <div className="flex items-center gap-2"><LockKeyhole className="size-4 text-emerald-400" /><h4 className="font-semibold text-white">Modifier le mot de passe</h4></div>
        <p className="text-[11px] text-zinc-500">Votre mot de passe actuel est demandé pour empêcher une modification par une session volée.</p>
        <input required type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Mot de passe actuel" className="w-full rounded-lg border border-white/10 bg-[#101114] p-2.5 text-white outline-none focus:border-emerald-400" />
        <div className="grid gap-2 sm:grid-cols-2">
          <input required minLength={6} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Nouveau mot de passe" className="w-full rounded-lg border border-white/10 bg-[#101114] p-2.5 text-white outline-none focus:border-emerald-400" />
          <input required minLength={6} type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirmer le nouveau mot de passe" className="w-full rounded-lg border border-white/10 bg-[#101114] p-2.5 text-white outline-none focus:border-emerald-400" />
        </div>
        <button disabled={isPasswordSaving} className="rounded-lg bg-emerald-500 px-3 py-2 font-semibold text-black disabled:opacity-50">{isPasswordSaving ? "Modification..." : "Enregistrer le nouveau mot de passe"}</button>
      </form>

      <form onSubmit={activateMfa} className="rounded-xl border border-white/[0.08] bg-[#14161b] p-4 space-y-3">
        <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><ShieldCheck className="size-4 text-emerald-400" /><h4 className="font-semibold text-white">Authentification à deux facteurs</h4></div><span className={mfaActive ? "text-emerald-400" : "text-amber-400"}>{mfaActive ? "Active" : "Non configurée"}</span></div>
        <p className="text-[11px] text-zinc-500">Un code SMS sera demandé en plus du mot de passe lors des connexions sensibles.</p>
        {!mfaActive && <>
          <div className="flex gap-2"><Smartphone className="mt-2.5 size-4 text-zinc-500" /><input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="Numéro avec indicatif, ex. +225..." className="flex-1 rounded-lg border border-white/10 bg-[#101114] p-2.5 text-white outline-none focus:border-emerald-400" /><button type="button" onClick={sendMfaCode} disabled={isMfaSending} className="rounded-lg border border-emerald-500/30 px-3 py-2 font-semibold text-emerald-300 disabled:opacity-50">{isMfaSending ? <Loader2 className="size-4 animate-spin" /> : "Envoyer le code"}</button></div>
          {verificationId && <div className="flex gap-2"><input required inputMode="numeric" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} placeholder="Code reçu par SMS" className="flex-1 rounded-lg border border-white/10 bg-[#101114] p-2.5 text-white outline-none focus:border-emerald-400" /><button disabled={isMfaSaving} className="rounded-lg bg-emerald-500 px-3 py-2 font-semibold text-black disabled:opacity-50">{isMfaSaving ? "Activation..." : "Activer"}</button></div>}
        </>}
      </form>

      <div className="rounded-xl border border-white/[0.08] bg-[#14161b] p-4"><h4 className="font-semibold text-white">Accès sans mot de passe</h4><p className="mt-1 text-[11px] text-zinc-500">Si vous avez oublié votre mot de passe, envoyez un lien de réinitialisation à {email || "votre adresse"}.</p><button type="button" onClick={() => { const currentAuth = auth; if (!email || !currentAuth) return setMessage({ type: "error", text: "Aucun compte connecté." }); sendPasswordResetEmail(currentAuth, email).then(() => setMessage({ type: "success", text: "Le lien de réinitialisation a été envoyé." })).catch((error) => setMessage({ type: "error", text: errorMessage(error) })); }} className="mt-3 rounded-lg border border-white/10 px-3 py-2 font-semibold text-zinc-200 hover:bg-white/5">Envoyer un lien de réinitialisation</button></div>
    </div>
  );
};
