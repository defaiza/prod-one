import { Suspense } from "react";

import { Chat } from "@/components/chat-simple";

interface ChatPageProps {
  params: Promise<{
    sessionId: string;
  }>;
}

export default async function ChatPage({ params }: ChatPageProps) {
  const { sessionId } = await params;

  return (
    <Suspense fallback={null}>
      <Chat sessionId={sessionId} />
    </Suspense>
  );
}
