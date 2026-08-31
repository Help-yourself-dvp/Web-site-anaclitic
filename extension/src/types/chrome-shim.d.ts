declare namespace chrome {
  namespace runtime {
    const onMessage: {
      addListener(
        callback: (
          message: unknown,
          sender: chrome.runtime.MessageSender,
          sendResponse: (response: unknown) => void,
        ) => boolean | void,
      ): void;
    };
    function sendMessage<T = unknown>(message: unknown): Promise<T>;
    function openOptionsPage(): Promise<void>;
  }
}
