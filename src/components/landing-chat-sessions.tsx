"use client";

import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { ChatSessions } from "@/components/chat-sessions";

export const LandingChatSessions = () => {
  const [userEntity, setUserEntity] = useState<string | null>(null);

  // Initialize user entity on client side only to avoid hydration mismatch
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedEntity = localStorage.getItem("elizaHowUserEntity");
      if (storedEntity) {
        setUserEntity(storedEntity);
      } else {
        const newEntity = uuidv4();
        localStorage.setItem("elizaHowUserEntity", newEntity);
        setUserEntity(newEntity);
      }
    }
  }, []);

  return (
    <div className="w-full">
      <ChatSessions userId={userEntity} />
    </div>
  );
};

export default LandingChatSessions;
