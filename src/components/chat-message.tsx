import {
  ArrowRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  LinkIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";
import { memo, useState } from "react";

import { CodeBlock } from "@/components/code-block";
import { MemoizedMarkdown } from "@/components/memoized-markdown";
import { Citation } from "@/types/chat";
import { ChatMessage as ChatMessageType } from "@/types/chat-message";
import { assert } from "@/utils/assert";

// Define constants if needed, or use literals directly
const USER_NAME = "User";
// const ASSISTANT_NAME = "Agent"; // Or get from message if dynamic

interface ChatMessageProps {
  message: ChatMessageType;
  i: number;
  citations?: Citation[];
  followUpPrompts?: string[];
  onFollowUpClick?: (prompt: string) => void;
}

export const ChatMessage = memo(function ChatMessage({
  message,
  i,
  citations,
  followUpPrompts,
  onFollowUpClick,
}: ChatMessageProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showThought, setShowThought] = useState(false);

  const isUserMessage = message.name === USER_NAME;

  // Filter out duplicate citations
  const uniqueCitations = citations?.filter(
    (citation, index, self) =>
      index === self.findIndex((c) => c.url === citation.url),
  );

  const markdownOptions = {
    remarkPlugins: [],
    rehypePlugins: [],
  };

  return (
    <div
      className={clsx(
        "w-full flex",
        isUserMessage ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={clsx(
          "max-w-[80%] rounded-lg p-4",
          isUserMessage
            ? "bg-blue-500 text-white"
            : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100",
        )}
      >
        <div
          className={clsx(
            "prose prose-zinc dark:prose-invert !max-w-full",
            "prose-headings:mt-0 prose-headings:mb-0 prose-headings:my-0 prose-p:mt-0",
            isUserMessage && "prose-invert",
          )}
        >
          <MemoizedMarkdown
            id={message.id || `msg-${i}-${message.createdAt}`}
            content={
              isUserMessage
                ? `### ${message.text ?? ""}`
                : (message.text ?? "")
            }
            options={markdownOptions}
          />
        </div>

        {!isUserMessage &&
          uniqueCitations &&
          uniqueCitations.length > 0 &&
          (isExpanded || uniqueCitations.length <= 3) && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Sources ({uniqueCitations.length})
                </span>
              </div>
              <div className="space-y-2">
                {uniqueCitations.map((citation, index) => (
                  <div
                    key={`${citation.url}-${index}`}
                    className="bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {citation.title || `Source ${index + 1}`}
                        </div>
                        {citation.url && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {citation.url}
                          </div>
                        )}
                        {citation.content && (
                          <div className="text-sm text-gray-700 dark:text-gray-300 mt-1 line-clamp-2">
                            {citation.content}
                          </div>
                        )}
                      </div>
                      {citation.url && (
                        <a
                          href={citation.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          <ArrowRightIcon className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        {!isUserMessage &&
          uniqueCitations &&
          uniqueCitations.length > 3 &&
          !isExpanded && (
            <button
              onClick={() => setIsExpanded(true)}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
            >
              <ChevronDownIcon className="w-4 h-4" />
              Show all {uniqueCitations.length} sources
            </button>
          )}

        {!isUserMessage &&
          uniqueCitations &&
          uniqueCitations.length > 3 &&
          isExpanded && (
            <button
              onClick={() => setIsExpanded(false)}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
            >
              <ChevronUpIcon className="w-4 h-4" />
              Show less
            </button>
          )}

        {!isUserMessage && message.thought && (
          <div className="mt-4">
            <button
              onClick={() => setShowThought(!showThought)}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 flex items-center gap-1"
            >
              {showThought ? (
                <>
                  <ChevronUpIcon className="w-4 h-4" />
                  Hide reasoning
                </>
              ) : (
                <>
                  <ChevronDownIcon className="w-4 h-4" />
                  Show reasoning
                </>
              )}
            </button>
            {showThought && (
              <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
                <div className="text-sm text-yellow-800 dark:text-yellow-200">
                  {message.thought}
                </div>
              </div>
            )}
          </div>
        )}

        {!isUserMessage && followUpPrompts && followUpPrompts.length > 0 && (
          <div className="mt-4">
            <div className="flex flex-col divide-y divide-gray-200 dark:divide-gray-700">
              {followUpPrompts.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => onFollowUpClick?.(prompt)}
                  className={clsx([
                    "flex items-center justify-between",
                    "py-2",
                    "bg-transparent",
                    "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200",
                    "transition-colors",
                    "group cursor-pointer",
                    "text-left text-sm",
                    "w-full",
                  ])}
                >
                  <span>{prompt}</span>
                  <ArrowRightIcon className="w-3 h-3 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});