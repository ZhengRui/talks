import Link from "next/link";
import { discoverPresentations } from "@/lib/loadPresentation";

export default function Home() {
  const presentations = discoverPresentations();

  return (
    <main className="min-h-screen bg-[#0a0a12] text-white p-8 md:p-16">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-bold mb-2">Presentations</h1>
        <p className="text-gray-400 mb-12">Select a presentation to begin</p>
        {presentations.length === 0 ? (
          <p className="text-gray-500">No presentations found.</p>
        ) : (
          <div className="grid gap-4">
            {presentations.map((p) => (
              <Link
                key={p.slug}
                href={`/${p.slug}`}
                className="group block p-6 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold group-hover:text-blue-400 transition-colors">
                      {p.title}
                    </h2>
                    {p.author && (
                      <p className="text-gray-400 text-sm mt-1">by {p.author}</p>
                    )}
                  </div>
                  <span className="text-gray-500 text-sm whitespace-nowrap ml-4">
                    {p.slideCount} slides
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
