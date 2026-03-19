import { createCallbackManager } from './callbacks';

const CRM_PARENT_ORIGIN = 'https://reports.apree-tech.com';
const CRM_API_URL = 'https://crm-api.apree-tech.com/api/v1';

// Folder name patterns per CRM role (case-insensitive matching)
const FOLDER_ROLE_MAP: Record<string, string[]> = {
  consulting_manager: ['консалтинг', 'consulting', 'рабочие', 'work', 'каналы', 'channels'],
  model_hunting_manager: ['хантинг', 'hunting', 'модел', 'model', 'рабочие', 'work', 'каналы', 'channels'],
  admin: [], // empty = show all
  head_pm: [], // same as admin
};

interface CrmState {
  role: string | undefined;
  userId: number | undefined;
  userName: string | undefined;
  isInCrmFrame: boolean;
}

const state: CrmState = {
  role: undefined,
  userId: undefined,
  userName: undefined,
  isInCrmFrame: false,
};

const roleChangeCallbacks = createCallbackManager();

function parseHashParams(): Record<string, string> {
  const hash = window.location.hash.replace('#', '');
  const params: Record<string, string> = {};
  if (!hash.startsWith('crm')) return params;

  const parts = hash.split('?')[1];
  if (!parts) return params;

  parts.split('&').forEach((pair) => {
    const [key, value] = pair.split('=');
    if (key && value) {
      params[key] = decodeURIComponent(value);
    }
  });
  return params;
}

function initCrmBridge() {
  // Check if we're inside an iframe
  try {
    state.isInCrmFrame = window.self !== window.top;
  } catch {
    state.isInCrmFrame = true;
  }

  if (!state.isInCrmFrame) return;

  // Parse initial role from URL hash
  const hashParams = parseHashParams();
  if (hashParams.role) {
    state.role = hashParams.role;
  }

  // Listen for postMessage from CRM parent
  window.addEventListener('message', (event) => {
    if (event.origin !== CRM_PARENT_ORIGIN) return;

    const { type, payload } = event.data || {};

    switch (type) {
      case 'crm:init':
        state.role = payload?.role;
        state.userId = payload?.userId;
        state.userName = payload?.userName;
        roleChangeCallbacks.runCallbacks();
        break;

      case 'crm:openChat':
        if (payload?.telegramChatId) {
          // Will be handled by the component that imports this
          crmNavigationCallbacks.runCallbacks(payload.telegramChatId);
        }
        break;

      case 'crm:roleChanged':
        state.role = payload?.role;
        roleChangeCallbacks.runCallbacks();
        break;

      default:
        break;
    }
  });

  // Signal to parent that we're ready
  sendToParent('tg:ready', {});
}

const crmNavigationCallbacks = createCallbackManager();

function sendToParent(type: string, payload: Record<string, unknown>) {
  if (!state.isInCrmFrame) return;
  try {
    window.parent.postMessage({ type, payload }, CRM_PARENT_ORIGIN);
  } catch {
    // Silently fail if parent is unreachable
  }
}

// Public API
export function getCrmRole(): string | undefined {
  return state.role;
}

export function getCrmUserId(): number | undefined {
  return state.userId;
}

export function getCrmUserName(): string | undefined {
  return state.userName;
}

export function isInCrmFrame(): boolean {
  return state.isInCrmFrame;
}

export function getCrmApiUrl(): string {
  return CRM_API_URL;
}

export function getAllowedFolderPatterns(): string[] | undefined {
  const role = state.role;
  if (!role) return undefined;

  const patterns = FOLDER_ROLE_MAP[role];
  if (!patterns || patterns.length === 0) return undefined; // admin sees all

  return patterns;
}

export function isFolderAllowedForRole(folderTitle: string): boolean {
  const patterns = getAllowedFolderPatterns();
  if (!patterns) return true; // No filter = show all

  const lowerTitle = folderTitle.toLowerCase();
  return patterns.some((pattern) => lowerTitle.includes(pattern));
}

export function onRoleChange(callback: NoneToVoidFunction): NoneToVoidFunction {
  return roleChangeCallbacks.addCallback(callback);
}

export function onCrmNavigateToChat(callback: (chatId: number) => void): NoneToVoidFunction {
  return crmNavigationCallbacks.addCallback(callback);
}

export function sendOpenDeal(dealId: number, chatId?: string) {
  sendToParent('tg:openDeal', { dealId, chatId });
}

export function sendCreateDeal(chatTitle: string, telegramChatId: number, tgUsername?: string) {
  sendToParent('tg:createDeal', { chatTitle, telegramChatId, tgUsername });
}

export function sendChatOpened(chatId: string, telegramChatId?: number) {
  sendToParent('tg:chatOpened', { chatId, telegramChatId });
}

export { initCrmBridge };
