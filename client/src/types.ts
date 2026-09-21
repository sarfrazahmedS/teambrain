export type Role = "USER" | "ADMIN";
export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER";
export type DocumentStatus = "PENDING" | "PROCESSING" | "READY" | "FAILED";
export type MessageRole = "USER" | "ASSISTANT";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
  documentCount: number;
  memberCount: number;
  createdAt: string;
}

export interface WorkspaceMember {
  id: string;
  name: string;
  email: string;
  role: WorkspaceRole;
}

export interface WorkspaceDetail {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  documentCount: number;
  conversationCount: number;
  members: WorkspaceMember[];
}

export interface DocumentItem {
  id: string;
  title: string;
  sourceType: string;
  status: DocumentStatus;
  error: string | null;
  charCount: number;
  chunkCount: number;
  createdAt: string;
}

export interface Citation {
  n: number;
  documentId: string;
  title: string;
  index: number;
}

export interface AskResponse {
  conversationId: string;
  answer: string;
  citations: Citation[];
}

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  citations?: Citation[] | null;
  createdAt: string;
}

export interface ConversationDetail extends ConversationSummary {
  messages: Message[];
}
