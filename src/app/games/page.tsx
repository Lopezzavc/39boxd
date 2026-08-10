export default function GamesPage() {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 mb-2">
        Juegos
      </h1>
      <p className="text-sm text-neutral-500 mb-8">
        Tu colección de videojuegos: completados, puntuados, pendientes...
      </p>

      <div className="rounded-2xl border border-neutral-200 bg-white p-8 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[2/3] animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800"
            />
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-neutral-400">
          Aquí verás los juegos que has añadido. Usa la lupa del header para buscar y agregar nuevos.
        </p>
      </div>
    </div>
  );
}
