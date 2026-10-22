import React, { useEffect, useState } from "react";
import { Bot, Building2, CheckCircle2, Loader2, MessageSquare, Send, UserRound } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Company } from "../../types";
import { getSavedCompanies, updateCompanyAutoReply } from "../../utils/companyStorage";
import {
  appendLocalSupportMessage,
  getLocalSupportConversations,
  LOCAL_SUPPORT_CONVERSATIONS_EVENT,
  LOCAL_SUPPORT_CONVERSATIONS_PREFIX,
} from "../../utils/localCommunityStore";

interface AssistanceViewProps {
  lang?: "fr" | "en";
  activeCompany?: Company | null;
  companies?: Company[];
  isPersonalWorkspace?: boolean;
  onNavigateToClients?: () => void;
}

interface SupportMessage {
  id: string;
  sender: "member" | "creator";
  text: string;
  time: string;
}

interface SupportConversation {
  id: string;
  companyId: string;
  memberName: string;
  memberEmail: string;
  messages: SupportMessage[];
}

const DEFAULT_MESSAGE = "Bonjour ! Merci d'avoir contacté notre équipe. Nous avons bien reçu votre message et nous vous répondrons dans les plus brefs délais.";

export const AssistanceView: React.FC<AssistanceViewProps> = ({ lang = "fr", activeCompany, companies = [], isPersonalWorkspace = false }) => {
  const { user } = useAuth();
  const userKey = user?.uid || user?.email || "default";
  const companyId = isPersonalWorkspace ? "" : activeCompany?.id || "";
  const [enabled, setEnabled] = useState(true);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const selectedCompany = isPersonalWorkspace ? null : activeCompany || null;
  const visibleConversations = conversations.filter(
    (conversation) =>
      !isPersonalWorkspace &&
      Boolean(activeCompany?.id) &&
      conversation.companyId === activeCompany?.id,
  );
  const selectedConversation = visibleConversations.find((conversation) => conversation.id === selectedConversationId) || null;

  useEffect(() => {
    setSelectedConversationId(null);
    setReply("");
  }, [activeCompany?.id, isPersonalWorkspace]);

  useEffect(() => {
    if (!companyId) {
      setEnabled(true);
      setMessage(DEFAULT_MESSAGE);
      setFeedback(null);
      return;
    }
    const current =
      getSavedCompanies(userKey).find((company) => company.id === companyId) ||
      companies.find((company) => company.id === companyId) ||
      activeCompany;
    setEnabled(current?.supportAutoReplyEnabled ?? true);
    setMessage(current?.supportAutoReplyMessage || DEFAULT_MESSAGE);
    setFeedback(null);
  }, [companyId, userKey, companies, activeCompany]);

  useEffect(() => {
    if (!companyId || isPersonalWorkspace) {
      setConversations([]);
      return;
    }
    const refreshConversations = () => {
      const next = getLocalSupportConversations(companyId);
      setConversations(next);
      setSelectedConversationId((current) =>
        current && next.some((conversation) => conversation.id === current)
          ? current
          : next[0]?.id || null,
      );
    };
    const handleStorage = (event: StorageEvent) => {
      if (!event.key?.startsWith(LOCAL_SUPPORT_CONVERSATIONS_PREFIX)) return;
      if (event.key !== `${LOCAL_SUPPORT_CONVERSATIONS_PREFIX}${companyId}`) return;
      refreshConversations();
    };
    refreshConversations();
    window.addEventListener(LOCAL_SUPPORT_CONVERSATIONS_EVENT, refreshConversations);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(LOCAL_SUPPORT_CONVERSATIONS_EVENT, refreshConversations);
      window.removeEventListener("storage", handleStorage);
    };
  }, [companyId, isPersonalWorkspace]);

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!companyId || !activeCompany?.id || companyId !== activeCompany.id || !message.trim()) {
      setFeedback("Sélectionnez une entreprise et renseignez un message.");
      return;
    }
    setIsSaving(true);
    try {
      updateCompanyAutoReply(userKey, companyId, { enabled, message: message.trim() });
      setFeedback("Message automatique enregistré.");
    } catch (error: any) {
      setFeedback(error?.message || "Impossible d’enregistrer le message.");
    } finally {
      setIsSaving(false);
    }
  };

  const sendReply = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedConversation || !reply.trim()) return;
    setIsSendingReply(true);
    const text = reply.trim();
    const replyMessage: SupportMessage = {
      id: `creator-${Date.now()}`,
      sender: "creator",
      text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    const persistedConversation = appendLocalSupportMessage({
      companyId: selectedConversation.companyId,
      memberEmail: selectedConversation.memberEmail,
      memberName: selectedConversation.memberName,
      sender: "creator",
      text,
    });
    if (!persistedConversation) {
      setConversations((previous) => previous.map((conversation) => conversation.id === selectedConversation.id ? { ...conversation, messages: [...conversation.messages, replyMessage] } : conversation));
    }
    setReply("");
    setIsSendingReply(false);
  };

  if (isPersonalWorkspace) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 animate-in fade-in duration-200">
        <section className="rounded-2xl border border-white/10 bg-[#121316] p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-400"><MessageSquare className="size-5" /></div>
            <div><h1 className="text-xl font-black text-white">Assistance personnelle</h1><p className="mt-1 text-xs text-zinc-400">Cet espace est réservé à votre compte personnel.</p></div>
          </div>
        </section>
        <section className="rounded-2xl border border-white/10 bg-[#121316] p-5 text-sm text-zinc-400">Pour répondre aux membres, sélectionnez une entreprise dans vos espaces de travail.</section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 animate-in fade-in duration-200">
      <section className="rounded-2xl border border-white/10 bg-[#121316] p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-400"><MessageSquare className="size-5" /></div>
          <div><h1 className="text-xl font-black text-white">Répondre aux membres</h1><p className="mt-1 text-xs text-zinc-400">Consultez les demandes reçues et répondez directement à chaque membre.</p></div>
        </div>
      </section>

      <section className="grid min-h-[460px] overflow-hidden rounded-2xl border border-white/10 bg-[#121316] lg:grid-cols-[280px_1fr]">
        <div className="border-b border-white/10 lg:border-b-0 lg:border-r">
          <div className="border-b border-white/10 px-4 py-3 text-xs font-semibold text-zinc-300">Demandes reçues</div>
          <div className="max-h-[410px] overflow-y-auto">
            {visibleConversations.length === 0 ? <div className="p-5 text-xs leading-relaxed text-zinc-500">Les demandes des membres apparaîtront ici.</div> : visibleConversations.map((conversation) => {
              const lastMessage = conversation.messages[conversation.messages.length - 1];
              return <button type="button" key={conversation.id} onClick={() => setSelectedConversationId(conversation.id)} className={`flex w-full items-start gap-3 border-b border-white/[0.06] p-4 text-left transition-colors ${selectedConversationId === conversation.id ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"}`}>
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#252830] text-xs font-bold text-white"><UserRound className="size-4" /></div>
                <div className="min-w-0"><div className="truncate text-xs font-semibold text-white">{conversation.memberName}</div><div className="truncate text-[11px] text-zinc-500">{conversation.memberEmail}</div><div className="mt-1 truncate text-[11px] text-zinc-400">{lastMessage?.text}</div></div>
              </button>;
            })}
          </div>
        </div>

        <div className="flex min-h-[420px] flex-col">
          {!selectedConversation ? <div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-zinc-500">Sélectionnez une demande pour consulter la conversation.</div> : <>
            <div className="border-b border-white/10 px-5 py-4"><div className="text-sm font-semibold text-white">{selectedConversation.memberName}</div><div className="mt-1 text-[11px] text-zinc-500">{selectedConversation.memberEmail}</div></div>
            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {selectedConversation.messages.map((item) => <div key={item.id} className={`flex ${item.sender === "creator" ? "justify-end" : "justify-start"}`}><div className={`max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed ${item.sender === "creator" ? "bg-blue-500 text-white" : "bg-white/[0.06] text-zinc-200"}`}><div>{item.text}</div><div className={`mt-1 text-[10px] ${item.sender === "creator" ? "text-blue-100" : "text-zinc-500"}`}>{item.time}</div></div></div>)}
            </div>
            <form onSubmit={sendReply} className="flex gap-2 border-t border-white/10 p-4"><textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={2} placeholder="Écrire une réponse..." className="min-w-0 flex-1 resize-none rounded-xl border border-white/10 bg-[#101114] p-3 text-xs text-white outline-none focus:border-blue-400" /><button type="submit" disabled={isSendingReply || !reply.trim()} className="ui-btn-primary self-end px-4 py-2.5 text-xs"><Send className="size-3.5" />Répondre</button></form>
          </>}
        </div>
      </section>

      <div className="rounded-2xl border border-white/10 bg-[#121316] p-5"><div className="flex items-start gap-3"><div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-400"><Bot className="size-5" /></div><div><h2 className="text-xl font-black text-white">{lang === "fr" ? "Message automatique" : "Auto-reply message"}</h2><p className="mt-1 text-xs text-zinc-400">Configurez la réponse envoyée automatiquement lorsqu’un membre contacte votre assistance.</p></div></div></div>
      <form onSubmit={save} className="space-y-5 rounded-2xl border border-white/10 bg-[#121316] p-5">
        <div><label className="mb-2 block text-xs font-semibold text-zinc-300">Entreprise active</label><div className="relative"><Building2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" /><div className="w-full rounded-xl border border-white/10 bg-[#101114] py-3 pl-10 pr-3 text-sm text-white">{selectedCompany?.name || "Aucune entreprise sélectionnée"}</div></div></div>
        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-4"><div><span className="block text-sm font-semibold text-white">Activer le message automatique</span><span className="mt-1 block text-[11px] text-zinc-500">Les membres reçoivent ce message dès l’ouverture d’une demande.</span></div><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="size-5 accent-blue-500" /></label>
        <div><label className="mb-2 block text-xs font-semibold text-zinc-300">Message envoyé</label><textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={6} maxLength={5000} placeholder={DEFAULT_MESSAGE} className="w-full resize-none rounded-xl border border-white/10 bg-[#101114] p-3 text-sm text-white outline-none focus:border-blue-400" /><div className="mt-1 text-right text-[10px] text-zinc-600">{message.length}/5000</div></div>
        {selectedCompany && <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-blue-200"><MessageSquare className="mr-2 inline size-4" />Aperçu pour <strong>{selectedCompany.name}</strong> : {message || "Votre message apparaîtra ici."}</div>}
        {feedback && <div className="flex items-center gap-2 text-xs text-emerald-300"><CheckCircle2 className="size-4" />{feedback}</div>}
        <div className="flex justify-end"><button type="submit" disabled={isSaving} className="ui-btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-xs">{isSaving && <Loader2 className="size-4 animate-spin" />}{isSaving ? "Enregistrement..." : "Enregistrer le message"}</button></div>
      </form>
    </div>
  );
};
