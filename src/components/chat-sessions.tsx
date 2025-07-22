"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Simple spinner component
const LoadingSpinner = () => (
  <svg
    className="animate-spin h-4 w-4 text-zinc-600 dark:text-zinc-400"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    ></circle>
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    ></path>
  </svg>
);

interface ChatSession {
  id: string;
  title: string;
  messageCount: number;
  lastActivity: string;
  preview: string;
  isFromAgent: boolean;
  channelId?: string;
}

interface ChatSessionsProps {
  userId: string | null;
  currentSessionId?: string;
  showSwitcher?: boolean;
}

export const ChatSessions = ({
  userId,
  currentSessionId,
  showSwitcher = false,
}: ChatSessionsProps) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!userId) return;

    const fetchSessions = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/chat-sessions?userId=${encodeURIComponent(userId)}`,
        );
        const data = await response.json();
        console.log('chat sessions data......',data)

        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch chat sessions");
        }

        setSessions(data.data?.sessions || []);
      } catch (err) {
        console.error("[ChatSessions] Error:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load chat sessions",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, [userId]);

  const handleSessionClick = (session: ChatSession) => {
    // Navigate to the chat session page
    router.push(`/chat/${session.id}`);
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (!userId) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="flex items-center gap-2">
          <LoadingSpinner />
          <span className="text-zinc-600 dark:text-zinc-400">
            Loading chat sessions...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-700 dark:text-red-300 text-sm">
          Failed to load chat sessions: {error}
        </p>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">
          {showSwitcher
            ? "No other chat sessions found"
            : "No previous chat sessions"}
        </p>
      </div>
    );
  }

  const filteredSessions = showSwitcher
    ? sessions.filter((s) => s.id !== currentSessionId)
    : sessions;

  if (showSwitcher && filteredSessions.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">
          No other chat sessions found
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {showSwitcher && (
        <h3 className="text-sm font-semibold text-zinc-700 mb-3">
          Switch to another conversation:
        </h3>
      )}

      {!showSwitcher && (
        <h3 className="text-lg font-semibold text-zinc-900 mb-4">
          Previous Conversations
        </h3>
      )}

      <div className="space-y-2">
        {filteredSessions.map((session) => (
          <div
            key={session.id}
            onClick={() => handleSessionClick(session)}
            className="group cursor-pointer bg-white border border-zinc-950/10 rounded-lg p-4 hover:bg-zinc-100 transition-all duration-200"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-zinc-900 text-sm group-hover:text-zinc-700 transition-colors line-clamp-1">
                  {session.title}
                </h4>
                {session.preview && (
                  <p className="text-zinc-600 text-xs mt-1 line-clamp-2">
                    {session.isFromAgent ? "🤖 " : ""}
                    {session.preview}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                  <span>
                    {session.messageCount} message
                    {session.messageCount !== 1 ? "s" : ""}
                  </span>
                  <span>•</span>
                  <span>{formatTimeAgo(session.lastActivity)}</span>
                </div>
              </div>
              <div className="flex items-center">
                <span className="text-zinc-400 group-hover:text-zinc-700 transition-colors">
                  &gt;
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChatSessions;
