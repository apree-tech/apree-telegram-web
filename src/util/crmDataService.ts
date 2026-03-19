import { getCrmApiUrl, getCrmRole, getCrmUserId, getCrmUserName } from './crmBridge';
import { createCallbackManager } from './callbacks';

interface ChatCategory {
  category: string;
  confidence: number;
  classifiedBy: string;
}

interface DealChatLink {
  dealId: number;
  dealNumber: string;
  stageName: string;
  stageColor: string;
  funnelName: string;
}

interface DealSearchResult {
  id: number;
  number: string;
  title: string;
  stageName: string;
  stageColor: string;
  funnelName: string;
}

const chatCategories = new Map<number, ChatCategory>();
const dealChatLinks = new Map<number, DealChatLink>();
const dataChangeCallbacks = createCallbackManager();

let pollingInterval: ReturnType<typeof setInterval> | undefined;
let isInitialized = false;

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const userId = getCrmUserId();
  const userName = getCrmUserName();
  const role = getCrmRole();

  if (userId) headers['X-User-Id'] = String(userId);
  if (userName) headers['X-User-Name'] = userName;
  if (role) headers['X-User-Type'] = role;

  return headers;
}

async function fetchChatCategories() {
  try {
    const response = await fetch(`${getCrmApiUrl()}/chats/categories`, {
      headers: getHeaders(),
    });
    if (!response.ok) return;

    const data = await response.json();
    chatCategories.clear();
    if (Array.isArray(data)) {
      data.forEach((item: { telegram_chat_id: number; category: string; confidence: number; classified_by: string }) => {
        chatCategories.set(item.telegram_chat_id, {
          category: item.category,
          confidence: item.confidence,
          classifiedBy: item.classified_by,
        });
      });
    }
  } catch {
    // Silently fail
  }
}

async function fetchDealChatLinks() {
  try {
    const response = await fetch(`${getCrmApiUrl()}/deals/chat-links`, {
      headers: getHeaders(),
    });
    if (!response.ok) return;

    const data = await response.json();
    dealChatLinks.clear();
    if (Array.isArray(data)) {
      data.forEach((item: {
        telegram_chat_id: number;
        deal_id: number;
        deal_number: string;
        stage_name: string;
        stage_color: string;
        funnel_name: string;
      }) => {
        dealChatLinks.set(item.telegram_chat_id, {
          dealId: item.deal_id,
          dealNumber: item.deal_number,
          stageName: item.stage_name,
          stageColor: item.stage_color,
          funnelName: item.funnel_name,
        });
      });
    }
  } catch {
    // Silently fail
  }
}

async function refreshAll() {
  await Promise.all([
    fetchChatCategories(),
    fetchDealChatLinks(),
  ]);
  dataChangeCallbacks.runCallbacks();
}

export function initCrmDataService() {
  if (isInitialized) return;
  isInitialized = true;

  // Initial fetch
  refreshAll();

  // Poll every 30 seconds
  pollingInterval = setInterval(refreshAll, 30000);
}

export function stopCrmDataService() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = undefined;
  }
  isInitialized = false;
}

export function getChatCategory(telegramChatId: number): ChatCategory | undefined {
  return chatCategories.get(telegramChatId);
}

export function getDealForChat(telegramChatId: number): DealChatLink | undefined {
  return dealChatLinks.get(telegramChatId);
}

export function onDataChange(callback: NoneToVoidFunction): NoneToVoidFunction {
  return dataChangeCallbacks.addCallback(callback);
}

export async function searchDeals(query: string): Promise<DealSearchResult[]> {
  try {
    const response = await fetch(`${getCrmApiUrl()}/deals/search?q=${encodeURIComponent(query)}`, {
      headers: getHeaders(),
    });
    if (!response.ok) return [];
    return await response.json();
  } catch {
    return [];
  }
}

export async function linkDealToChat(dealId: number, telegramChatId: number): Promise<boolean> {
  try {
    const response = await fetch(`${getCrmApiUrl()}/deals/${dealId}/link-chat`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ telegram_chat_id: telegramChatId }),
    });
    if (response.ok) {
      await refreshAll();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function getDealsForChat(telegramChatId: number): Promise<DealSearchResult[]> {
  try {
    const response = await fetch(`${getCrmApiUrl()}/deals/by-chat/${telegramChatId}`, {
      headers: getHeaders(),
    });
    if (!response.ok) return [];
    return await response.json();
  } catch {
    return [];
  }
}
