import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bot, CheckCircle2, Loader2, MessageSquare, Search, Send, Settings, UserRound } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Company } from "../../types";
import { getSavedCompanies, updateCompanyAutoReply } from "../../utils/companyStorage";
import { appendLocalSupportMessage, getLocalSupportConversations, LOCAL_SUPPORT_CONVERSATIONS_EVENT, LOCAL_SUPPORT_CONVERSATIONS_PREFIX } from "../../utils/localCommunityStore";

interface AssistanceViewProps { lang?: "fr" | "en"; activeCompany?: Company | null; companies?: Company[]; isPersonalWorkspace?: boolean; onNavigateToClients?: () => void; }
interface SupportMessage { id: string; sender: "member" | "creator"; text: string; time: string; }
interface SupportConversation { id: string; companyId: string; memberName: string; memberEmail: string; messages: SupportMessage[]; }
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"recent" | "oldest">("recent");
  const isCreator = !isPersonalWorkspace && Boolean(activeCompany?.id);
  const visibleConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return conversations.filter((conversation) => !query || `${conversation.memberName} ${conversation.memberEmail} ${conversation.messages.at(-1)?.text || ""}`.toLowerCase().includes(query)).sort((a, b) => {
      const aLast = a.messages.at(-1)?.id || "";
      const bLast = b.messages.at(-1)?.id || "";
      return sortOrder === "recent" ? bLast.localeCompare(aLast) : aLast.localeCompare(bLast);
    });
  }, [conversations, searchQuery, sortOrder]);
  const selectedConversation = visibleConversations.find((conversation) => conversation.id === selectedConversationId) || null;

  useEffect(() => { setSelectedConversationId(null); setReply(""); setIsSettingsOpen(false); }, [activeCompany?.id, isPersonalWorkspace]);
  useEffect(() => {
    if (!companyId) { setEnabled(true); setMessage(DEFAULT_MESSAGE); setFeedback(null); setConversations([]); return; }
    const current = getSavedCompanies(userKey).find((company) => company.id === companyId) || companies.find((company) => company.id === companyId) || activeCompany;
    setEnabled(current?.supportAutoReplyEnabled ?? true); setMessage(current?.supportAutoReplyMessage || DEFAULT_MESSAGE); setFeedback(null);
  }, [companyId, userKey, companies, activeCompany]);
  useEffect(() => {
    if (!companyId || isPersonalWorkspace) return;
    const refresh = () => { const next = getLocalSupportConversations(companyId); setConversations(next); setSelectedConversationId((current) => current && next.some((item) => item.id === current) ? current : next[0]?.id || null); };
    const handleStorage = (event: StorageEvent) => { if (event.key?.startsWith(LOCAL_SUPPORT_CONVERSATIONS_PREFIX)) refresh(); };
    refresh(); window.addEventListener(LOCAL_SUPPORT_CONVERSATIONS_EVENT, refresh); window.addEventListener("storage", handleStorage);
    return () => { window.removeEventListener(LOCAL_SUPPORT_CONVERSATIONS_EVENT, refresh); window.removeEventListener("storage", handleStorage); };
  }, [companyId, isPersonalWorkspace]);
  const save = (event: React.FormEvent) => {
    event.preventDefault(); if (!companyId || !activeCompany?.id || !message.trim()) { setFeedback("Sélectionnez une entreprise et renseignez un message."); return; }
    setIsSaving(true); try { updateCompanyAutoReply(userKey, companyId, { enabled, message: message.trim() }); setFeedback("Message automatique enregistré."); } catch (error: any) { setFeedback(error?.message || "Impossible d’enregistrer le message."); } finally { setIsSaving(false); }
  };
  const sendReply = (event: React.FormEvent) => {
    event.preventDefault(); if (!selectedConversation || !reply.trim()) return;
    appendLocalSupportMessage({ companyId: selectedConversation.companyId, memberEmail: selectedConversation.memberEmail, memberName: selectedConversation.memberName, sender: "creator", text: reply.trim() });
    setReply("");
  };
  return <div className="mx-auto flex h-[calc(100dvh-140px)] max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#121316] animate-in fade-in duration-200">
    <header className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#16171b] px-4 py-3 sm:px-5">
      <div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-400"><MessageSquare className="size-5" /></div><div><h1 className="text-sm font-bold text-white">{isPersonalWorkspace ? "Assistance" : "Chats de support"}</h1><p className="text-[11px] text-zinc-500">{isPersonalWorkspace ? "Vos demandes d’assistance" : `Assistance de ${activeCompany?.name || "votre entreprise"}`}</p></div></div>
      {isCreator && <button type="button" onClick={() => setIsSettingsOpen((open) => !open)} className={`rounded-lg p-2 text-zinc-400 transition hover:bg-white/[0.06] hover:text-white ${isSettingsOpen ? "bg-white/[0.08] text-white" : ""}`} aria-label="Paramètres du message automatique"><Settings className="size-4" /></button>}
    </header>
    {isSettingsOpen && isCreator && <form onSubmit={save} className="shrink-0 space-y-3 border-b border-white/10 bg-[#101114] p-4 sm:p-5"><div className="flex items-center gap-2"><Bot className="size-4 text-blue-400" /><h2 className="text-sm font-bold text-white">Message automatique</h2></div><div className="flex flex-col gap-3 sm:flex-row sm:items-end"><label className="flex flex-1 flex-col gap-1 text-[11px] text-zinc-400">Message envoyé<textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={3} maxLength={5000} className="mt-1 resize-none rounded-xl border border-white/10 bg-[#0c0d0e] p-3 text-xs text-white outline-none focus:border-blue-400" /></label><label className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-3 text-xs text-zinc-300"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="size-4 accent-blue-500" />Activer</label><button type="submit" disabled={isSaving} className="ui-btn-primary inline-flex items-center justify-center gap-2 px-4 py-3 text-xs">{isSaving && <Loader2 className="size-3.5 animate-spin" />}{isSaving ? "Enregistrement…" : "Enregistrer"}</button></div>{feedback && <div className="flex items-center gap-2 text-xs text-emerald-300"><CheckCircle2 className="size-3.5" />{feedback}</div>}</form>}
    <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[300px_1fr]">
      <aside className={`min-h-0 border-b border-white/10 lg:border-b-0 lg:border-r ${selectedConversation ? "hidden lg:block" : "block"}`}><div className="space-y-2 border-b border-white/10 p-3"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Rechercher…" className="w-full rounded-xl border border-white/10 bg-[#0c0d0e] py-2.5 pl-9 pr-3 text-xs text-white outline-none focus:border-blue-400" /></div><select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as "recent" | "oldest")} className="rounded-lg border border-white/10 bg-[#0c0d0e] px-2.5 py-2 text-[11px] text-zinc-300 outline-none"><option value="recent">Dernière activité</option><option value="oldest">Plus ancienne</option></select></div><div className="max-h-56 overflow-y-auto lg:max-h-none">{visibleConversations.length === 0 ? <div className="p-5 text-xs leading-relaxed text-zinc-500">{isPersonalWorkspace ? "Vos demandes d’assistance apparaîtront ici." : "Les demandes des membres apparaîtront ici."}</div> : visibleConversations.map((conversation) => { const last = conversation.messages.at(-1); return <button type="button" key={conversation.id} onClick={() => setSelectedConversationId(conversation.id)} className={`flex w-full items-start gap-3 border-b border-white/[0.06] p-4 text-left ${selectedConversationId === conversation.id ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"}`}><div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#252830] text-xs font-bold text-white"><UserRound className="size-4" /></div><div className="min-w-0"><div className="truncate text-xs font-semibold text-white">{conversation.memberName}</div><div className="truncate text-[11px] text-zinc-500">{conversation.memberEmail}</div><div className="mt-1 truncate text-[11px] text-zinc-400">{last?.text || "Nouvelle conversation"}</div></div></button>; })}</div></aside>
      <main className={`min-h-0 flex-1 flex-col ${selectedConversation ? "flex" : "hidden lg:flex"}`}>{!selectedConversation ? <div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-zinc-500">Sélectionnez une conversation pour consulter le chat.</div> : <><div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-5"><button type="button" onClick={() => setSelectedConversationId(null)} className="rounded-lg p-2 text-zinc-400 hover:bg-white/[0.06] hover:text-white lg:hidden" aria-label="Retour à la liste"><ArrowLeft className="size-4" /></button><div className="flex size-9 items-center justify-center rounded-full bg-[#252830] text-xs font-bold text-white"><UserRound className="size-4" /></div><div><div className="text-sm font-semibold text-white">{selectedConversation.memberName}</div><div className="text-[11px] text-zinc-500">{selectedConversation.memberEmail}</div></div></div><div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">{selectedConversation.messages.map((item) => <div key={item.id} className={`flex ${item.sender === "creator" ? "justify-end" : "justify-start"}`}><div className={`max-w-[82%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${item.sender === "creator" ? "bg-blue-500 text-white" : "bg-white/[0.06] text-zinc-200"}`}><div>{item.text}</div><div className={`mt-1 text-[10px] ${item.sender === "creator" ? "text-blue-100" : "text-zinc-500"}`}>{item.time}</div></div></div>)}</div><form onSubmit={sendReply} className="flex shrink-0 gap-2 border-t border-white/10 p-3 sm:p-4"><textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={2} placeholder="Écrire un message…" className="min-w-0 flex-1 resize-none rounded-xl border border-white/10 bg-[#101114] p-3 text-xs text-white outline-none focus:border-blue-400" /><button type="submit" disabled={!reply.trim()} className="ui-btn-primary self-end px-4 py-2.5 text-xs"><Send className="size-3.5" /></button></form></>}</main>
    </div>
  </div>;
};
