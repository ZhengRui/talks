export interface ParsedSseEvent {
  event: string;
  data: string;
}

export interface SseParserState {
  buffer: string;
  currentEvent: string;
  currentDataLines: string[];
}

export function createSseParserState(): SseParserState {
  return {
    buffer: "",
    currentEvent: "",
    currentDataLines: [],
  };
}

function readFieldValue(line: string, prefix: string): string {
  const value = line.slice(prefix.length);
  return value.startsWith(" ") ? value.slice(1) : value;
}

export function consumeSseChunk(
  state: SseParserState,
  chunk: string,
  flush: boolean = false,
): ParsedSseEvent[] {
  if (chunk) {
    state.buffer += chunk;
  }

  const lines = state.buffer.split(/\r?\n/);
  if (!flush) {
    state.buffer = lines.pop() ?? "";
  } else {
    state.buffer = "";
  }

  const events: ParsedSseEvent[] = [];

  const dispatch = () => {
    if (state.currentEvent && state.currentDataLines.length > 0) {
      events.push({
        event: state.currentEvent,
        data: state.currentDataLines.join("\n"),
      });
    }
    state.currentEvent = "";
    state.currentDataLines = [];
  };

  for (const line of lines) {
    if (line === "") {
      dispatch();
      continue;
    }

    if (line.startsWith("event:")) {
      state.currentEvent = readFieldValue(line, "event:");
      continue;
    }

    if (line.startsWith("data:")) {
      state.currentDataLines.push(readFieldValue(line, "data:"));
    }
  }

  if (flush) {
    dispatch();
  }

  return events;
}
