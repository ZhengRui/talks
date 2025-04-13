import Link from 'next/link';

// Placeholder data - later we can generate this dynamically
const presentations = [
  { slug: 'example', title: 'Example Presentation' },
  // Add more presentations here
];

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center p-24">
      <h1 className="text-4xl font-bold mb-8">Presentations</h1>
      <ul className="list-disc space-y-2">
        {presentations.map((presentation) => (
          <li key={presentation.slug}>
            <Link href={`/${presentation.slug}`} className="text-blue-500 hover:underline">
              {presentation.title}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
