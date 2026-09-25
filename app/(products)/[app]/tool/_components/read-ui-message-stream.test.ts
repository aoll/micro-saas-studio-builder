import { describe, expect, it } from "vitest";
import { GenerationFailedError, readUiMessageStream } from "./read-ui-message-stream";

function sseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<string[]> {
  const deltas: string[] = [];
  for await (const delta of readUiMessageStream(stream)) deltas.push(delta);
  return deltas;
}

describe("readUiMessageStream", () => {
  it("yields text-delta chunks in order", async () => {
    const stream = sseStream([
      `data: ${JSON.stringify({ type: "start" })}\n\n`,
      `data: ${JSON.stringify({ type: "text-start", id: "1" })}\n\n`,
      `data: ${JSON.stringify({ type: "text-delta", id: "1", delta: "Bonjour" })}\n\n`,
      `data: ${JSON.stringify({ type: "text-delta", id: "1", delta: " le monde" })}\n\n`,
      `data: ${JSON.stringify({ type: "text-end", id: "1" })}\n\n`,
      `data: ${JSON.stringify({ type: "finish" })}\n\n`,
      "data: [DONE]\n\n",
    ]);
    expect(await collect(stream)).toEqual(["Bonjour", " le monde"]);
  });

  it("reassembles a line split across two chunks", async () => {
    const full = `data: ${JSON.stringify({ type: "text-delta", id: "1", delta: "Bonjour" })}\n\n`;
    const mid = Math.floor(full.length / 2);
    const stream = sseStream([full.slice(0, mid), full.slice(mid)]);
    expect(await collect(stream)).toEqual(["Bonjour"]);
  });

  it("reassembles a multi-byte character split across two chunks", async () => {
    // "é" is 2 UTF-8 bytes: splitting the encoded line between them checks
    // the decoder is fed with { stream: true } across reads.
    const encoder = new TextEncoder();
    const line = `data: ${JSON.stringify({ type: "text-delta", id: "1", delta: "café" })}\n\n`;
    const bytes = encoder.encode(line);
    // Find the byte offset that lands inside the 2-byte "é" sequence.
    const splitAt = bytes.length - 3;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, splitAt));
        controller.enqueue(bytes.slice(splitAt));
        controller.close();
      },
    });
    expect(await collect(stream)).toEqual(["café"]);
  });

  it("ignores non-text chunk types", async () => {
    const stream = sseStream([
      `data: ${JSON.stringify({ type: "start-step" })}\n\n`,
      `data: ${JSON.stringify({ type: "text-delta", id: "1", delta: "x" })}\n\n`,
      `data: ${JSON.stringify({ type: "finish-step" })}\n\n`,
    ]);
    expect(await collect(stream)).toEqual(["x"]);
  });

  it("throws GenerationFailedError on an error chunk", async () => {
    const stream = sseStream([
      `data: ${JSON.stringify({ type: "text-delta", id: "1", delta: "partiel" })}\n\n`,
      `data: ${JSON.stringify({ type: "error", errorText: "generation_failed" })}\n\n`,
    ]);
    await expect(collect(stream)).rejects.toThrow(GenerationFailedError);
    await expect(
      collect(sseStream([`data: ${JSON.stringify({ type: "error", errorText: "generation_failed" })}\n\n`])),
    ).rejects.toMatchObject({ errorText: "generation_failed" });
  });

  it("throws on malformed JSON", async () => {
    const stream = sseStream(["data: {not json\n\n"]);
    await expect(collect(stream)).rejects.toThrow();
  });
});
