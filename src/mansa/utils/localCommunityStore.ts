export interface LocalCompanyMember {
  memberId: string;
  email: string;
  name: string;
  joinedAt: string;
}

export interface LocalSupportMessage {
  id: string;
  sender: "member" | "creator";
  text: string;
  time: string;
}

export interface LocalSupportConversation {
  id: string;
  companyId: string;
  memberName: string;
  memberEmail: string;
  messages: LocalSupportMessage[];
}

export interface LocalPrivateMessage {
  id: string;
  sender: "member" | "creator";
  text: string;
  time: string;
}

export interface LocalPrivateConversation {
  id: string;
  companyId: string;
  memberName: string;
  memberEmail: string;
  messages: LocalPrivateMessage[];
}

export const LOCAL_COMPANY_MEMBERS_PREFIX = "mansa_local_company_members_";
export const LOCAL_SUPPORT_CONVERSATIONS_PREFIX = "mansa_local_support_conversations_";
export const LOCAL_COMPANY_MEMBERS_EVENT = "mansa_local_company_members_updated";
export const LOCAL_SUPPORT_CONVERSATIONS_EVENT = "mansa_support_conversations_updated";
export const LOCAL_PRIVATE_CONVERSATIONS_PREFIX = "mansa_private_conversations_";
export const LOCAL_PRIVATE_CONVERSATIONS_EVENT = "mansa_private_conversations_updated";
const SUBSCRIPTIONS_STORAGE_KEY_PREFIX = "mansa_enterprise_subscriptions_";

const isDevelopment = import.meta.env.DEV;

function readArray<T>(key: string): T[] {
  if (!isDevelopment || typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function dispatchLocalUpdate(eventName: string, companyId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(eventName, { detail: { companyId } }));
}

function makeId(prefix: string) {
  const randomId = globalThis.crypto?.randomUUID?.();
  return `${prefix}-${randomId || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`}`;
}

export function getLocalCompanyMembers(companyId: string): LocalCompanyMember[] {
  if (!companyId) return [];
  const members = new Map(
    readArray<LocalCompanyMember>(`${LOCAL_COMPANY_MEMBERS_PREFIX}${companyId}`).map((member) => [
      member.memberId,
      member,
    ]),
  );
  if (!isDevelopment || typeof window === "undefined") return [...members.values()];

  try {
    for (const key of Object.keys(window.localStorage)) {
      if (!key.startsWith(SUBSCRIPTIONS_STORAGE_KEY_PREFIX)) continue;
      const memberId = key.slice(SUBSCRIPTIONS_STORAGE_KEY_PREFIX.length);
      if (!memberId) continue;
      const subscriptions = readArray<{
        id?: string;
        companyId?: string;
        companyName?: string;
        status?: string;
        isCommunityPreview?: boolean;
        hasJoined?: boolean;
      }>(key);
      if (
        !subscriptions.some(
          (subscription) =>
            subscription.companyId === companyId &&
            subscription.status !== "canceled" &&
            !subscription.isCommunityPreview &&
            subscription.hasJoined !== false,
        )
      ) {
        continue;
      }
      const existing = members.get(memberId);
      const email = memberId.includes("@") ? memberId.toLowerCase() : existing?.email || "";
      members.set(memberId, {
        memberId,
        email,
        name: existing?.name || (email ? email.split("@")[0] || "Membre" : "Membre"),
        joinedAt: existing?.joinedAt || "",
      });
    }
  } catch {
    // Keep the explicit local member index usable when browser storage enumeration is restricted.
  }
  return [...members.values()];
}

export function getLocalCompanyMemberCount(companyId: string): number {
  return getLocalCompanyMembers(companyId).length;
}

export function registerLocalCompanyMember(
  companyId: string,
  member: { memberId: string; email?: string; name?: string },
): LocalCompanyMember[] {
  if (!isDevelopment || typeof window === "undefined" || !companyId || !member.memberId) return [];
  const key = `${LOCAL_COMPANY_MEMBERS_PREFIX}${companyId}`;
  const current = getLocalCompanyMembers(companyId);
  const existing = current.find((item) => item.memberId === member.memberId);
  const entry: LocalCompanyMember = {
    memberId: member.memberId,
    email: member.email || existing?.email || "",
    name: member.name || existing?.name || member.email || "Membre",
    joinedAt: existing?.joinedAt || new Date().toISOString(),
  };
  const updated = existing
    ? current.map((item) => (item.memberId === member.memberId ? entry : item))
    : [...current, entry];
  try {
    window.localStorage.setItem(key, JSON.stringify(updated));
    dispatchLocalUpdate(LOCAL_COMPANY_MEMBERS_EVENT, companyId);
    dispatchLocalUpdate("mansa_discoverable_companies_updated", companyId);
  } catch (error) {
    console.warn("Could not save the local development member index:", error);
  }
  return updated;
}

export function unregisterLocalCompanyMember(companyId: string, memberId: string): void {
  if (!isDevelopment || typeof window === "undefined" || !companyId || !memberId) return;
  const key = `${LOCAL_COMPANY_MEMBERS_PREFIX}${companyId}`;
  const updated = getLocalCompanyMembers(companyId).filter((item) => item.memberId !== memberId);
  try {
    window.localStorage.setItem(key, JSON.stringify(updated));
    dispatchLocalUpdate(LOCAL_COMPANY_MEMBERS_EVENT, companyId);
    dispatchLocalUpdate("mansa_discoverable_companies_updated", companyId);
  } catch (error) {
    console.warn("Could not update the local development member index:", error);
  }
}

export function getLocalSupportConversations(companyId: string): LocalSupportConversation[] {
  if (!companyId) return [];
  return readArray<LocalSupportConversation>(`${LOCAL_SUPPORT_CONVERSATIONS_PREFIX}${companyId}`);
}

export function getLocalSupportConversation(
  companyId: string,
  memberEmail: string,
): LocalSupportConversation | null {
  const normalizedEmail = memberEmail.trim().toLowerCase();
  return (
    getLocalSupportConversations(companyId).find(
      (conversation) => conversation.memberEmail.trim().toLowerCase() === normalizedEmail,
    ) || null
  );
}

export function appendLocalSupportMessage(input: {
  companyId: string;
  memberEmail: string;
  memberName: string;
  sender: LocalSupportMessage["sender"];
  text: string;
}): LocalSupportConversation | null {
  if (
    !isDevelopment ||
    typeof window === "undefined" ||
    !input.companyId ||
    !input.memberEmail ||
    !input.text.trim()
  ) {
    return null;
  }
  const key = `${LOCAL_SUPPORT_CONVERSATIONS_PREFIX}${input.companyId}`;
  const conversations = getLocalSupportConversations(input.companyId);
  const existing = conversations.find(
    (conversation) =>
      conversation.memberEmail.trim().toLowerCase() === input.memberEmail.trim().toLowerCase(),
  );
  const nextMessage: LocalSupportMessage = {
    id: makeId(input.sender),
    sender: input.sender,
    text: input.text.trim(),
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
  const nextConversation: LocalSupportConversation = existing
    ? {
        ...existing,
        memberName: input.memberName || existing.memberName,
        messages: [...existing.messages, nextMessage],
      }
    : {
        id: `${input.companyId}:${input.memberEmail.trim().toLowerCase()}`,
        companyId: input.companyId,
        memberName: input.memberName || "Membre",
        memberEmail: input.memberEmail.trim().toLowerCase(),
        messages: [nextMessage],
      };
  const updated = existing
    ? conversations.map((conversation) =>
        conversation.id === existing.id ? nextConversation : conversation,
      )
    : [...conversations, nextConversation];
  try {
    window.localStorage.setItem(key, JSON.stringify(updated));
    dispatchLocalUpdate(LOCAL_SUPPORT_CONVERSATIONS_EVENT, input.companyId);
  } catch (error) {
    console.warn("Could not save the local development support message:", error);
    return null;
  }
  return nextConversation;
}

export function getLocalPrivateConversations(companyId: string): LocalPrivateConversation[] {
  if (!companyId) return [];
  return readArray<LocalPrivateConversation>(`${LOCAL_PRIVATE_CONVERSATIONS_PREFIX}${companyId}`);
}

export function getAllLocalPrivateConversations(): LocalPrivateConversation[] {
  if (!isDevelopment || typeof window === "undefined") return [];
  const conversations: LocalPrivateConversation[] = [];
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith(LOCAL_PRIVATE_CONVERSATIONS_PREFIX)) {
        conversations.push(...readArray<LocalPrivateConversation>(key));
      }
    }
  } catch {
    // Keep the inbox empty when browser storage is unavailable.
  }
  return conversations;
}

export function appendLocalPrivateMessage(input: {
  companyId: string;
  memberEmail: string;
  memberName: string;
  sender: LocalPrivateMessage["sender"];
  text: string;
}): LocalPrivateConversation | null {
  if (
    !isDevelopment ||
    typeof window === "undefined" ||
    !input.companyId ||
    !input.memberEmail ||
    !input.text.trim()
  ) {
    return null;
  }
  const key = `${LOCAL_PRIVATE_CONVERSATIONS_PREFIX}${input.companyId}`;
  const conversations = getLocalPrivateConversations(input.companyId);
  const normalizedEmail = input.memberEmail.trim().toLowerCase();
  const existing = conversations.find(
    (conversation) => conversation.memberEmail.trim().toLowerCase() === normalizedEmail,
  );
  const nextMessage: LocalPrivateMessage = {
    id: makeId(input.sender),
    sender: input.sender,
    text: input.text.trim(),
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
  const nextConversation: LocalPrivateConversation = existing
    ? {
        ...existing,
        memberName: input.memberName || existing.memberName,
        messages: [...existing.messages, nextMessage],
      }
    : {
        id: `${input.companyId}:${normalizedEmail}`,
        companyId: input.companyId,
        memberName: input.memberName || "Membre",
        memberEmail: normalizedEmail,
        messages: [nextMessage],
      };
  const updated = existing
    ? conversations.map((conversation) =>
        conversation.id === existing.id ? nextConversation : conversation,
      )
    : [...conversations, nextConversation];
  try {
    window.localStorage.setItem(key, JSON.stringify(updated));
    dispatchLocalUpdate(LOCAL_PRIVATE_CONVERSATIONS_EVENT, input.companyId);
  } catch (error) {
    console.warn("Could not save the local private message:", error);
    return null;
  }
  return nextConversation;
}
