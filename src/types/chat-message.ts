export interface ChatMessage {
  id: string;
  name: string;
  text: string | null | undefined;
  senderId: string;
  roomId: string;
  createdAt: number;
  source: string;
  isLoading?: boolean;
  thought?: string;
  actions?: any[]; // Consider defining a more specific type if the structure is known
}
