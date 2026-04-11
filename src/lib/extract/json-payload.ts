export function extractJsonPayload(resultText: string): string | null {
  const fenced = resultText.match(/```json\s*([\s\S]*?)\s*```/i)
    ?? resultText.match(/```\s*([\s\S]*?)\s*```/);
  if (fenced?.[1]) return fenced[1];

  const trimmed = resultText.trim();
  if (!trimmed) return null;

  const firstObject = trimmed.indexOf("{");
  const firstArray = trimmed.indexOf("[");
  const startCandidates = [firstObject, firstArray].filter((index) => index >= 0);
  if (startCandidates.length === 0) return null;

  const start = Math.min(...startCandidates);
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let index = start; index < trimmed.length; index += 1) {
    const char = trimmed[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      stack.push("}");
      continue;
    }

    if (char === "[") {
      stack.push("]");
      continue;
    }

    if (char === "}" || char === "]") {
      if (stack.length === 0 || stack[stack.length - 1] !== char) {
        return null;
      }
      stack.pop();
      if (stack.length === 0) {
        return trimmed.slice(start, index + 1);
      }
    }
  }

  return null;
}
