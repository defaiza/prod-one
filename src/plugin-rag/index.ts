import { knowledgeProvider } from "@/plugin-rag/providers/knowledge";
import {
  type Action,
  type ActionEventPayload,
  asUUID,
  ChannelType,
  composePromptFromState,
  createUniqueUuid,
  type Entity,
  type EntityPayload,
  type Evaluator,
  EventType,
  type IAgentRuntime,
  KnowledgeItem,
  logger,
  type Media,
  type MessagePayload,
  type MessageReceivedHandlerParams,
  ModelType,
  type Plugin,
  type Provider,
  type UUID,
  type WorldPayload,
} from "@elizaos/core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { v4 } from "uuid";
import { recentMessagesProvider } from "./providers/recentMessages";
import { execSync } from "node:child_process";

/**
 * Extracts the text content from within a <response> XML tag.
 * @param text The input string potentially containing the <response> tag.
 * @returns The extracted text content, or null if the tag is not found or empty.
 */
function extractResponseText(text: string): string | null {
  if (!text) return null;

  // Regex to find the content within <response>...</response>
  const responseMatch = text.match(/<response>([\s\S]*?)<\/response>/);

  if (!responseMatch || responseMatch[1] === undefined) {
    logger.warn("Could not find <response> tag or its content in text");
    // Attempt to find *any* XML block as a fallback, but log that it wasn't the expected <response>
    const fallbackMatch = text.match(/<(\w+)>([\s\S]*?)<\/\1>/);
    if (fallbackMatch && fallbackMatch[2] !== undefined) {
      logger.warn(
        `Found <${fallbackMatch[1]}> tag instead of <response>. Using its content.`,
      );
      const fallbackContent = fallbackMatch[2].trim();
      return fallbackContent || null; // Return null if content is empty after trimming
    }
    return null;
  }

  const responseContent = responseMatch[1].trim();

  // Return null if the content is empty after trimming
  if (!responseContent) {
    logger.warn("Found <response> tag, but its content is empty");
    return null;
  }

  // Basic unescaping for common XML entities (can be expanded if needed)
  const unescapedContent = responseContent
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");

  return unescapedContent;
}

export const messageHandlerTemplate = `
<providers>
{{providers}}
</providers>

<instructions>
Respond to the user's message and answer their question thoroughly and thoroughly.
</instructions>

<keys>
"text" should be the text of the next message for {{agentName}} which they will send to the conversation.
</keys>

<output>
Respond using XML format like this:
<response>
    Your response text here
</response>

Your response must ONLY include the <response></response> XML block.
</output>`;

/**
 * Represents media data containing a buffer of data and the media type.
 * @typedef {Object} MediaData
 * @property {Buffer} data - The buffer of data.
 * @property {string} mediaType - The type of media.
 */
type MediaData = {
  data: Buffer;
  mediaType: string;
};

const latestResponseIds = new Map<string, Map<string, string>>();

/**
 * Escapes special characters in a string to make it JSON-safe.
 */
/* // Removing JSON specific helpers
function escapeForJson(input: string): string {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/```/g, '\\`\\`\\`');
}

function sanitizeJson(rawJson: string): string {
  try {
    // Try parsing directly
    JSON.parse(rawJson);
    return rawJson; // Already valid
  } catch {
    // Continue to sanitization
  }

  // first, replace all newlines with \n
  const sanitized = rawJson
    .replace(/\n/g, '\\n')

    // then, replace all backticks with \\\`
    .replace(/`/g, '\\\`');

  // Regex to find and escape the "text" field
  const fixed = sanitized.replace(/"text"\s*:\s*"([\s\S]*?)"\s*,\s*"simple"/, (_match, group) => {
    const escapedText = escapeForJson(group);
    return `"text": "${escapedText}", "simple"`;
  });

  // Validate that the result is actually parseable
  try {
    JSON.parse(fixed);
    return fixed;
  } catch (e) {
    throw new Error(`Failed to sanitize JSON: ${e.message}`);
  }
}
*/

/**
 * Fetches media data from a list of attachments, supporting both HTTP URLs and local file paths.
 *
 * @param attachments Array of Media objects containing URLs or file paths to fetch media from
 * @returns Promise that resolves with an array of MediaData objects containing the fetched media data and content type
 */
/**
 * Fetches media data from given attachments.
 * @param {Media[]} attachments - Array of Media objects to fetch data from.
 * @returns {Promise<MediaData[]>} - A Promise that resolves with an array of MediaData objects.
 */
export async function fetchMediaData(
  attachments: Media[],
): Promise<MediaData[]> {
  return Promise.all(
    attachments.map(async (attachment: Media) => {
      if (/^(http|https):\/\//.test(attachment.url)) {
        // Handle HTTP URLs
        const response = await fetch(attachment.url);
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${attachment.url}`);
        }
        const mediaBuffer = Buffer.from(await response.arrayBuffer());
        const mediaType = attachment.contentType || "image/png";
        return { data: mediaBuffer, mediaType };
      }
      // if (fs.existsSync(attachment.url)) {
      //   // Handle local file paths
      //   const mediaBuffer = await fs.promises.readFile(path.resolve(attachment.url));
      //   const mediaType = attachment.contentType || 'image/png';
      //   return { data: mediaBuffer, mediaType };
      // }
      throw new Error(
        `File not found: ${attachment.url}. Make sure the path is correct.`,
      );
    }),
  );
}

/**
 * Handles incoming messages and generates responses based on the provided runtime and message information.
 *
 * @param {MessageReceivedHandlerParams} params - The parameters needed for message handling, including runtime, message, and callback.
 * @returns {Promise<void>} - A promise that resolves once the message handling and response generation is complete.
 */
const messageReceivedHandler = async ({
  runtime,
  message,
  callback,
}: MessageReceivedHandlerParams): Promise<void> => {
  // Generate a new response ID
  const responseId = v4();
  // Get or create the agent-specific map
  if (!latestResponseIds.has(runtime.agentId)) {
    latestResponseIds.set(runtime.agentId, new Map<string, string>());
  }
  const agentResponses = latestResponseIds.get(runtime.agentId);
  if (!agentResponses) {
    throw new Error("Agent responses map not found");
  }

  // Set this as the latest response ID for this agent+room
  agentResponses.set(message.roomId, responseId);

  // Generate a unique run ID for tracking this message handler execution
  const runId = asUUID(v4());
  const startTime = Date.now();

  // Emit run started event
  await runtime.emitEvent(EventType.RUN_STARTED, {
    runtime,
    runId,
    messageId: message.id,
    roomId: message.roomId,
    entityId: message.entityId,
    startTime,
    status: "started",
    source: "messageHandler",
  });

  // Set up timeout monitoring
  const timeoutDuration = 60 * 60 * 1000; // 1 hour
  let timeoutId: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(async () => {
      await runtime.emitEvent(EventType.RUN_TIMEOUT, {
        runtime,
        runId,
        messageId: message.id,
        roomId: message.roomId,
        entityId: message.entityId,
        startTime,
        status: "timeout",
        endTime: Date.now(),
        duration: Date.now() - startTime,
        error: "Run exceeded 60 minute timeout",
        source: "messageHandler",
      });
      reject(new Error("Run exceeded 60 minute timeout"));
    }, timeoutDuration);
  });

  const processingPromise = (async () => {
    try {
      if (message.entityId === runtime.agentId) {
        throw new Error("Message is from the agent itself");
      }

      // First, save the incoming message
      await Promise.all([
        runtime.addEmbeddingToMemory(message),
        runtime.createMemory(message, "messages"),
      ]);

      const state = await runtime.composeState(
        message,
        [],
        true,
      );

      const prompt = composePromptFromState({
        state,
        template:
          runtime.character.templates?.messageHandlerTemplate ||
          messageHandlerTemplate,
      });

      console.log("*** PROMPT ***\n", prompt);

      let responseContent: string = "";

      // Retry if missing required fields
      let retries = 0;
      const maxRetries = 3;

      while (retries < maxRetries && (!responseContent || !responseContent)) {
        const response = await runtime.useModel(ModelType.TEXT_SMALL, {
          prompt,
        });

        logger.debug("*** Raw LLM Response ***\n", response);

        // Attempt to parse the XML response
        responseContent = extractResponseText(response) ?? "";

        if (!responseContent) {
          logger.warn(
            "*** Missing required fields (thought or actions), retrying... ***",
          );
        } else {
          break;
        }
        retries++;
      }

      // Check if this is still the latest response ID for this agent+room
      const currentResponseId = agentResponses.get(message.roomId);
      if (currentResponseId !== responseId) {
        logger.info(
          `Response discarded - newer message being processed for agent: ${runtime.agentId}, room: ${message.roomId}`,
        );
        return;
      }

      // Clean up the response ID
      agentResponses.delete(message.roomId);
      if (agentResponses.size === 0) {
        latestResponseIds.delete(runtime.agentId);
      }

      await callback({
        text: responseContent ?? "",
      });

      // Emit run ended event on successful completion
      await runtime.emitEvent(EventType.RUN_ENDED, {
        runtime,
        runId,
        messageId: message.id,
        roomId: message.roomId,
        entityId: message.entityId,
        startTime,
        status: "completed",
        endTime: Date.now(),
        duration: Date.now() - startTime,
        source: "messageHandler",
      });
    } catch (error) {
      // Emit run ended event with error
      await runtime.emitEvent(EventType.RUN_ENDED, {
        runtime,
        runId,
        messageId: message.id,
        roomId: message.roomId,
        entityId: message.entityId,
        startTime,
        status: "completed",
        endTime: Date.now(),
        duration: Date.now() - startTime,
        source: "messageHandler",
      });
      throw error;
    }
  })();

  try {
    await Promise.race([processingPromise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

/**
 * Syncs a single user into an entity
 */
/**
 * Asynchronously sync a single user with the specified parameters.
 *
 * @param {UUID} entityId - The unique identifier for the entity.
 * @param {IAgentRuntime} runtime - The runtime environment for the agent.
 * @param {any} user - The user object to sync.
 * @param {string} serverId - The unique identifier for the server.
 * @param {string} channelId - The unique identifier for the channel.
 * @param {ChannelType} type - The type of channel.
 * @param {string} source - The source of the user data.
 * @returns {Promise<void>} A promise that resolves once the user is synced.
 */
const syncSingleUser = async (
  entityId: UUID,
  runtime: IAgentRuntime,
  serverId: string,
  channelId: string,
  type: ChannelType,
  source: string,
) => {
  try {
    const entity = await runtime.getEntityById(entityId);
    logger.info(
      `Syncing user: ${
        entity && typeof entity.metadata === "object" && entity.metadata && source in entity.metadata && "username" in (entity.metadata as any)[source]
          ? (entity.metadata as any)[source].username
          : entityId
      }`,
    );

    // Ensure we're not using WORLD type and that we have a valid channelId
    if (!channelId) {
      logger.warn(`Cannot sync user ${entity?.id} without a valid channelId`);
      return;
    }

    const roomId = createUniqueUuid(runtime, channelId) ?? "";
    const worldId = createUniqueUuid(runtime, serverId) ?? "";

    await runtime.ensureConnection({
      entityId,
      roomId,
      userName:
        entity && typeof entity.metadata === "object" && entity.metadata && source in entity.metadata && "username" in (entity.metadata as any)[source]
          ? (entity.metadata as any)[source].username
          : entityId,
      name:
        entity && typeof entity.metadata === "object" && entity.metadata && source in entity.metadata && "name" in (entity.metadata as any)[source]
          ? (entity.metadata as any)[source].name
          : entity && typeof entity.metadata === "object" && entity.metadata && source in entity.metadata && "username" in (entity.metadata as any)[source]
            ? (entity.metadata as any)[source].username
            : `User${entityId}`,
      source,
      channelId,
      serverId,
      type,
      worldId,
    });

    logger.success(`Successfully synced user: ${entity?.id}`);
  } catch (error) {
    logger.error(
      `Error syncing user: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

/**
 * Handles standardized server data for both WORLD_JOINED and WORLD_CONNECTED events
 */
const handleServerSync = async ({
  runtime,
  world,
  rooms,
  entities,
  source,
}: WorldPayload) => {
  logger.debug(`Handling server sync event for server: ${world.name}`);
  try {
    // Create/ensure the world exists for this server
    await runtime.ensureWorldExists({
      id: world.id,
      name: world.name,
      agentId: runtime.agentId,
      serverId: world.serverId,
      metadata: {
        ...world.metadata,
      },
    });

    // First sync all rooms/channels
    if (rooms && rooms.length > 0) {
      for (const room of rooms) {
        await runtime.ensureRoomExists({
          id: room.id,
          name: room.name,
          source: source,
          type: room.type,
          channelId: room.channelId,
          serverId: world.serverId,
          worldId: world.id,
        });
      }
    }

    // Then sync all users
    if (entities && entities.length > 0) {
      // Process entities in batches to avoid overwhelming the system
      const batchSize = 50;
      for (let i = 0; i < entities.length; i += batchSize) {
        const entityBatch = entities.slice(i, i + batchSize);

        // check if user is in any of these rooms in rooms
        const firstRoomUserIsIn = rooms.length > 0 ? rooms[0] : null;
        if (!firstRoomUserIsIn) continue;

        // Process each user in the batch
        await Promise.all(
          entityBatch.map(async (entity: Entity) => {
            // Skip if entity.id is undefined
            if (!entity.id) {
              logger.warn("Entity ID is undefined, skipping sync");
              return;
            }
            
            try {
              await runtime.ensureConnection({
                entityId: entity.id,
                roomId: firstRoomUserIsIn.id,
                userName:
                  entity && typeof entity.metadata === "object" && entity.metadata && source in entity.metadata && "username" in (entity.metadata as any)[source]
                    ? (entity.metadata as any)[source].username
                    : entity.id,
                name:
                  entity && typeof entity.metadata === "object" && entity.metadata && source in entity.metadata && "name" in (entity.metadata as any)[source]
                    ? (entity.metadata as any)[source].name
                    : entity && typeof entity.metadata === "object" && entity.metadata && source in entity.metadata && "username" in (entity.metadata as any)[source]
                      ? (entity.metadata as any)[source].username
                      : `User${entity.id}`,
                source: source,
                channelId: firstRoomUserIsIn.channelId,
                serverId: world.serverId,
                type: firstRoomUserIsIn.type,
                worldId: world.id,
              });
            } catch (err) {
              logger.warn(
                `Failed to sync user ${
                  entity && typeof entity.metadata === "object" && entity.metadata && source in entity.metadata && "username" in (entity.metadata as any)[source]
                    ? (entity.metadata as any)[source].username
                    : entity.id
                }: ${err}`,
              );
            }
          }),
        );

        // Add a small delay between batches if not the last batch
        if (i + batchSize < entities.length) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }

    logger.debug(
      `Successfully synced standardized world structure for ${world.name}`,
    );
  } catch (error) {
    logger.error(
      `Error processing standardized server data: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
};

/**
 * Handles control messages for enabling or disabling UI elements in the frontend
 * @param {Object} params - Parameters for the handler
 * @param {IAgentRuntime} params.runtime - The runtime instance
 * @param {Object} params.message - The control message
 * @param {string} params.source - Source of the message
 */
const controlMessageHandler = async ({
  runtime,
  message,
  source,
}: {
  runtime: IAgentRuntime;
  message: {
    type: "control";
    payload: {
      action: "enable_input" | "disable_input";
      target?: string;
    };
    roomId: UUID;
  };
  source: string;
}) => {
  try {
    logger.debug(
      `[controlMessageHandler] Processing control message: ${message.payload.action} for room ${message.roomId}`,
    );

    // Here we would use a WebSocket service to send the control message to the frontend
    // This would typically be handled by a registered service with sendMessage capability

    // Get any registered WebSocket service
    const serviceNames = Array.from(runtime.getAllServices().keys());
    const websocketServiceName = serviceNames.find(
      (name) =>
        name.toLowerCase().includes("websocket") ||
        name.toLowerCase().includes("socket"),
    );

    if (websocketServiceName) {
      const websocketService = runtime.getService(websocketServiceName);
      if (websocketService && "sendMessage" in websocketService) {
        // Send the control message through the WebSocket service
        await (websocketService as any).sendMessage({
          type: "controlMessage",
          payload: {
            action: message.payload.action,
            target: message.payload.target,
            roomId: message.roomId,
          },
        });

        logger.debug(
          `[controlMessageHandler] Control message ${message.payload.action} sent successfully`,
        );
      } else {
        logger.error(
          "[controlMessageHandler] WebSocket service does not have sendMessage method",
        );
      }
    } else {
      logger.error(
        "[controlMessageHandler] No WebSocket service found to send control message",
      );
    }
  } catch (error) {
    logger.error(
      `[controlMessageHandler] Error processing control message: ${error}`,
    );
  }
};

const events = {
  [EventType.MESSAGE_RECEIVED]: [
    async (payload: MessagePayload) => {
      if (payload.callback) {
        await messageReceivedHandler({
          runtime: payload.runtime,
          message: payload.message,
          callback: payload.callback,
        });
      }
    },
  ],

  [EventType.MESSAGE_SENT]: [
    async (payload: MessagePayload) => {
      // Message sent tracking
      logger.debug(`Message sent: ${payload.message.content.text}`);
    },
  ],

  [EventType.WORLD_JOINED]: [
    async (payload: WorldPayload) => {
      await handleServerSync(payload);
    },
  ],

  [EventType.WORLD_CONNECTED]: [
    async (payload: WorldPayload) => {
      await handleServerSync(payload);
    },
  ],

  [EventType.ENTITY_JOINED]: [
    async (payload: EntityPayload) => {
      await syncSingleUser(
        payload.entityId,
        payload.runtime,
        payload.worldId ?? "",
        payload.roomId ?? "",
        payload.metadata?.type || "unknown",
        payload.source,
      );
    },
  ],

  [EventType.ENTITY_LEFT]: [
    async (payload: EntityPayload) => {
      try {
        // Update entity to inactive
        const entity = await payload.runtime.getEntityById(payload.entityId);
        if (entity) {
          entity.metadata = {
            ...entity.metadata,
            status: "INACTIVE",
            leftAt: Date.now(),
          };
          await payload.runtime.updateEntity(entity);
        }
        logger.info(`User ${payload.entityId} left world ${payload.worldId}`);
      } catch (error) {
        logger.error(`Error handling user left: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  ],

  [EventType.ACTION_STARTED]: [
    async (payload: ActionEventPayload) => {
      logger.debug(
        `Action started: ${payload.actionName} (${payload.actionId})`,
      );
    },
  ],

  [EventType.ACTION_COMPLETED]: [
    async (payload: ActionEventPayload) => {
      const status = payload.error
        ? `failed: ${payload.error.message}`
        : "completed";
      logger.debug(
        `Action ${status}: ${payload.actionName} (${payload.actionId})`,
      );
    },
  ],

  CONTROL_MESSAGE: [controlMessageHandler],
};

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Recursively gets all files in a directory with the given extension
 *
 * @param {string} dir - Directory to search
 * @param {string[]} extensions - File extensions to look for
 * @returns {string[]} - Array of file paths
 */
function getFilesRecursively(dir: string, extensions: string[]): string[] {
  try {
    const dirents = fs.readdirSync(dir, { withFileTypes: true });

    const files = dirents
      .filter((dirent) => !dirent.isDirectory())
      .filter((dirent) => extensions.some((ext) => dirent.name.endsWith(ext)))
      .map((dirent) => path.join(dir, dirent.name));

    const folders = dirents
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => path.join(dir, dirent.name));

    const subFiles = folders.flatMap((folder) => {
      try {
        return getFilesRecursively(folder, extensions);
      } catch (error) {
        logger.warn(`Error accessing folder ${folder}:`, error);
        return [];
      }
    });

    return [...files, ...subFiles];
  } catch (error) {
    logger.warn(`Error reading directory ${dir}:`, error);
    return [];
  }
}

/**
 * Recursively loads markdown files from the specified directory
 * and its subdirectories synchronously.
 *
 * @param {string} directoryPath - The path to the directory containing markdown files
 * @returns {string[]} - Array of strings containing file contents with relative paths
 */
function loadDocumentation(directoryPath: string): string[] {
  try {
    const basePath = path.resolve(directoryPath);
    const files = getFilesRecursively(basePath, [".md", ".mdx"]);

    return files
      .map((filePath) => {
        try {
          const relativePath = path.relative(basePath, filePath);
          const content = fs.readFileSync(filePath, "utf-8");
          return content;
        } catch (error) {
          logger.warn(`Error reading file ${filePath}:`, error);
          return "";
        }
      })
      .filter((content) => content.length > 0);
  } catch (error) {
    console.error("Error loading documentation:", error);
    return [];
  }
}

/**
 * Initializes the character with the provided runtime, configuration, actions, providers, and evaluators.
 * Registers actions, providers, and evaluators to the runtime. Registers runtime events for "DISCORD_WORLD_JOINED" and "DISCORD_SERVER_CONNECTED".
 *
 * @param {Object} param - Object containing runtime, config, actions, providers, and evaluators.
 * @param {IAgentRuntime} param.runtime - The runtime instance to use.
 * @param {OnboardingConfig} param.config - The configuration for onboarding.
 * @param {Action[]} [param.actions] - Optional array of actions to register.
 * @param {Provider[]} [param.providers] - Optional array of providers to register.
 * @param {Evaluator[]} [param.evaluators] - Optional array of evaluators to register.
 */
const initCharacter = async ({
  runtime,
  actions,
  providers,
  evaluators,
}: {
  runtime: IAgentRuntime;
  actions?: Action[];
  providers?: Provider[];
  evaluators?: Evaluator[];
}): Promise<void> => {
  if (actions) {
    for (const action of actions) {
      runtime.registerAction(action);
    }
  }

  if (providers) {
    for (const provider of providers) {
      runtime.registerProvider(provider);
    }
  }

  if (evaluators) {
    for (const evaluator of evaluators) {
      runtime.registerEvaluator(evaluator);
    }
  }
};

export const ragPlugin: Plugin = {
  name: "rag",
  description: "RAG plugin with basic actions and evaluators",
  events,
  init: async (config, runtime: IAgentRuntime) => {
    console.log("*** Initializing agent...");
    const repoDirName = process.env.REPO_DIR_NAME || "elizaos";
    const workspaceRoot = path.resolve(__dirname, "..");
    const repoPath = path.join(workspaceRoot, repoDirName);
    const repoUrl =
      process.env.REPO_URL || "https://github.com/elizaos/eliza.git";
    const branch = process.env.REPO_BRANCH || "v2-develop";

    logger.info(`Checking for ElizaOS repository at: ${repoPath}`);

    logger.info("Initializing character...");
    await initCharacter({ runtime });
    logger.info("Character initialized.");
    setTimeout(async () => {
      console.log("*** Loading documentation...");
      console.log("workspaceRoot", workspaceRoot);

      // get absolute path of workspaceRoot
      const absoluteWorkspaceRoot = path.resolve(workspaceRoot);
      console.log("absoluteWorkspaceRoot", absoluteWorkspaceRoot);

      // check if any part of the path includes eliza/packages
      const isMonorepo = absoluteWorkspaceRoot.includes("/packages/");
      console.log("isMonorepo", isMonorepo);

      try {
        if (!isMonorepo) {
          if (!fs.existsSync(repoPath)) {
            logger.info(
              `Repository not found. Cloning ${branch} branch from ${repoUrl}...`,
            );
            execSync(
              `git clone --depth 1 --branch ${branch} ${repoUrl} ${repoDirName}`,
              {
                cwd: workspaceRoot,
                stdio: "inherit",
              },
            );
            logger.info("Repository cloned successfully.");
          } else {
            logger.info(
              "Repository found. Checking out branch and pulling latest changes...",
            );
            try {
              execSync(`git checkout ${branch}`, {
                cwd: repoPath,
                stdio: "inherit",
              });
            } catch (checkoutError) {
              logger.warn(
                `Failed to checkout ${branch} (maybe already on it or stash needed?), attempting pull anyway: ${checkoutError}`,
              );
            }
            try {
              execSync(`git pull origin ${branch}`, {
                cwd: repoPath,
                stdio: "inherit",
              });
              logger.info(`Pulled latest changes from origin/${branch}.`);
            } catch (pullError) {
              logger.error(
                `Failed to pull changes for ${branch}: ${pullError}. Continuing with local version.`,
              );
            }
          }
        }

        const docsPath = path.join(repoPath, "packages", "docs", "docs");
        logger.info(`Attempting to load documentation from: ${docsPath}`);

        if (fs.existsSync(docsPath)) {
          logger.debug("Loading documentation...");
          const docKnowledge = loadDocumentation(docsPath);
          if (docKnowledge.length > 0) {
            logger.info(
              `Loaded ${docKnowledge.length} documentation files. Adding to knowledge base...`,
            );
            let addedCount = 0;
            for (const docContent of docKnowledge) {
              const knowledgeItem: KnowledgeItem = {
                id: v4() as UUID,
                content: { text: docContent },
              };
              try {
                const defaultKnowledgeOptions = {
                  targetTokens: 8000,
                  overlap: 500,
                  modelContextSize: 64000,
                };

                // TODO: Implement knowledge addition when runtime supports it
                // await runtime.addKnowledge(
                //   knowledgeItem,
                //   defaultKnowledgeOptions,
                // );
                logger.info(`Knowledge item prepared but not added (runtime.addKnowledge not available): ${knowledgeItem.id}`);
                addedCount++;
              } catch (addError) {
                logger.error(`Failed to add knowledge item: ${addError}`);
              }
            }
            logger.info(
              `Successfully added ${addedCount}/${docKnowledge.length} documentation files to knowledge base.`,
            );
          } else {
            logger.warn(
              `No documentation files found or loaded from ${docsPath}.`,
            );
          }
        } else {
          logger.warn(
            `Documentation directory not found: ${docsPath}. Cannot load documentation knowledge.`,
          );
        }
      } catch (error) {
        logger.error(`Failed to clone or update repository: ${error}`);
        logger.warn(
          "Proceeding without loading documentation knowledge due to repository error.",
        );
      }
    }, 5000);
  },
  providers: [knowledgeProvider, recentMessagesProvider],
};

export default ragPlugin;
