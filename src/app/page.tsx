import Link from "next/link";
import { discoverPresentations } from "@/lib/loadPresentation";

export default function Home() {
  const presentations = discoverPresentations();

  return (
    <main className="flex min-h-screen flex-col items-center p-24">
      <h1 className="text-4xl font-bold mb-8">Presentations</h1>
      {presentations.length === 0 ? (
        <p className="text-gray-500">No presentations found.</p>
      ) : (
        <ul className="list-disc space-y-2">
          {presentations.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/${p.slug}`}
                className="text-blue-500 hover:underline"
              >
                {p.title}
              </Link>
              {p.author && (
                <span className="text-gray-400 ml-2">by {p.author}</span>
              )}
              <span className="text-gray-500 ml-2">
                ({p.slideCount} slides)
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
