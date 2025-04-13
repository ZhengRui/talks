"use client"; // Mark this as a Client Component

import { useEffect, useRef, useId } from "react"; // Added useId for unique instance tracking
import type RevealType from "reveal.js"; // Keep type import
// Note: CSS imports are correctly placed in layout.tsx

// Track global instances to assist with cleanup across navigations
const activeInstances = new Set<string>();

interface RevealPresentationProps {
  children: React.ReactNode;
}

const RevealPresentation: React.FC<RevealPresentationProps> = ({
  children,
}) => {
  const deckDivRef = useRef<HTMLDivElement>(null); // Ref for the deck container
  const deckRef = useRef<RevealType.Api | null>(null); // Correct type: RevealType.Api
  const isInitializedRef = useRef<boolean>(false); // Track initialization state
  const instanceId = useId(); // Generate a unique ID for this instance

  // Aggressive cleanup when component unmounts or before initialization
  const cleanupReveal = () => {
    try {
      if (deckRef.current) {
        deckRef.current.destroy();
        deckRef.current = null;
      }

      // Try to find and clean up any existing Reveal instances in the DOM
      // This helps when navigating between pages and React hasn't fully cleaned up
      if (typeof document !== "undefined") {
        const revealElements = document.querySelectorAll(".reveal");
        revealElements.forEach((el) => {
          // @ts-expect-error - Access potential internal Reveal instance
          if (el.reveal) {
            // @ts-expect-error - Handle clean up of reveal instance
            el.reveal.destroy();
            // @ts-expect-error - Nullify the instance
            el.reveal = null;
          }
        });
      }

      // Reset initialization flag
      isInitializedRef.current = false;
      activeInstances.delete(instanceId);
    } catch (e) {
      console.warn("Reveal.js cleanup failed", e);
    }
  };

  useEffect(() => {
    // Always clean up first to ensure no lingering instances
    cleanupReveal();

    // Prevent initializing if we've already done so or are missing the ref
    if (!deckDivRef.current) {
      return cleanupReveal;
    }

    // Mark that we're starting initialization
    isInitializedRef.current = true;
    activeInstances.add(instanceId);

    // Use a short timeout to ensure we're not battling with other cleanup operations
    const initTimeout = setTimeout(() => {
      // Dynamically import Reveal class
      import("reveal.js")
        .then((RevealModule) => {
          const Deck = RevealModule.default;

          // Dynamically import plugins
          return Promise.all([
            import("reveal.js/plugin/markdown/markdown.esm.js"),
            import("reveal.js/plugin/notes/notes.esm.js"),
          ]).then(([MarkdownModule, NotesModule]) => {
            // Double-check refs are still valid
            if (!deckDivRef.current || !isInitializedRef.current) {
              return;
            }

            deckRef.current = new Deck(deckDivRef.current, {
              embedded: true,
              plugins: [MarkdownModule.default, NotesModule.default],
              // Try with hash: false to help with navigation state
              hash: false,
            });

            // Use double requestAnimationFrame for reliable DOM rendering
            window.requestAnimationFrame(() => {
              window.requestAnimationFrame(() => {
                if (deckRef.current && isInitializedRef.current) {
                  deckRef.current.initialize().catch((err: Error) => {
                    console.error("Reveal.js initialization failed:", err);
                    isInitializedRef.current = false;
                  });
                }
              });
            });
          });
        })
        .catch((err: Error) => {
          console.error("Failed to load reveal.js or its plugins:", err);
          isInitializedRef.current = false;
          activeInstances.delete(instanceId);
        });
    }, 50); // Small delay to let any cleanup finish

    // Cleanup function
    return () => {
      clearTimeout(initTimeout);
      cleanupReveal();
    };
  }, []); // Run effect only once on mount

  return (
    // Use the ref on the outer reveal container
    <div className="reveal h-full w-full" ref={deckDivRef}>
      {/* Slides are passed in as children */}
      <div className="slides">{children}</div>
    </div>
  );
};

export default RevealPresentation;
