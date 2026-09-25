// Hand-written SSE reader (SA-02 plan › orchestrator decision 4: no
// @ai-sdk/react dependency added just for `useCompletion`). Reads
// `toUIMessageStreamResponse()`'s `data: <UIMessageChunk>\n\n` lines
// (node_modules/ai/dist/index.d.ts's `UIMessageChunk` union) and yields
// only the text deltas the tool's result card needs.

export class GenerationFailedError extends Error {
  constructor(public errorText: string) {
    super(errorText);
    this.name = "GenerationFailedError";
  }
}

type MinimalChunk = { type: string; delta?: string; errorText?: string };

export async function* readUiMessageStream(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    if (done) {
      buffer += decoder.decode();
    }

    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      if (!line.startsWith("data: ")) continue;

      const payload = line.slice("data: ".length);
      if (payload === "[DONE]") continue;

      const chunk = JSON.parse(payload) as MinimalChunk;
      if (chunk.type === "error") throw new GenerationFailedError(chunk.errorText ?? "generation_failed");
      if (chunk.type === "text-delta" && chunk.delta) yield chunk.delta;
    }

    if (done) return;
  }
}
