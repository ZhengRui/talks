"use client";

import { useEffect, useRef } from "react";
import type RevealType from "reveal.js";

interface PresentationProps {
  children: React.ReactNode;
}

const Presentation: React.FC<PresentationProps> = ({ children }) => {
  const deckDivRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef<RevealType.Api | null>(null);

  useEffect(() => {
    let destroyed = false;

    async function init() {
      if (!deckDivRef.current) return;

      const [{ default: Reveal }, { default: Notes }] = await Promise.all([
        import("reveal.js"),
        import("reveal.js/plugin/notes/notes.esm.js"),
      ]);

      if (destroyed || !deckDivRef.current) return;

      const deck = new Reveal(deckDivRef.current, {
        plugins: [Notes],
        hash: false,
        width: 1920,
        height: 1080,
      });

      await deck.initialize();
      if (destroyed) {
        deck.destroy();
        return;
      }

      deckRef.current = deck;
    }

    init();

    return () => {
      destroyed = true;
      if (deckRef.current) {
        deckRef.current.destroy();
        deckRef.current = null;
      }
    };
  }, []);

  return (
    <div className="reveal h-full w-full" ref={deckDivRef}>
      <div className="slides">{children}</div>
    </div>
  );
};

export default Presentation;
