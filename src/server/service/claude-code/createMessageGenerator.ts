import type { SDKMessage, SDKUserMessage } from "@anthropic-ai/claude-code";

export type OnMessage = (message: SDKMessage) => void | Promise<void>;

export type MessageGenerator = () => AsyncGenerator<
  SDKUserMessage,
  void,
  unknown
>;

const createPromise = () => {
  let promiseResolve: ((value: string) => void) | undefined;
  let promiseReject: ((reason?: unknown) => void) | undefined;

  const promise = new Promise<string>((resolve, reject) => {
    promiseResolve = resolve;
    promiseReject = reject;
  });

  if (!promiseResolve || !promiseReject) {
    throw new Error("Illegal state: Promise not created");
  }

  return {
    promise,
    resolve: promiseResolve,
    reject: promiseReject,
  } as const;
};

export const createMessageGenerator = (
  firstMessage: string,
): {
  generateMessages: MessageGenerator;
  setNextMessage: (message: string) => void;
} => {
  let currentPromise = createPromise();

  const createMessage = (message: string): SDKUserMessage => {
    return {
      type: "user",
      message: {
        role: "user",
        content: message,
      },
    } as SDKUserMessage;
  };

  async function* generateMessages(): ReturnType<MessageGenerator> {
    yield createMessage(firstMessage);

    while (true) {
      const message = await currentPromise.promise;
      currentPromise = createPromise();

      yield createMessage(message);
    }
  }

  const setNextMessage = (message: string) => {
    currentPromise.resolve(message);
  };

  return {
    generateMessages,
    setNextMessage,
  };
};
