export default function HomePage() {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 mb-8">
        Bienvenido a DATA
      </h1>

      <div className="grid grid-cols-1 gap-8">
        {/* Wishlist */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            🎯 Wishlist
          </h2>
          <p className="mt-2 text-sm text-neutral-500">
            Aquí aparecerán los juegos, películas o álbumes que quieres probar.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {/* Tarjetas placeholder */}
            <div className="aspect-[2/3] animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800" />
            <div className="aspect-[2/3] animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800" />
            <div className="aspect-[2/3] animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800" />
            <div className="aspect-[2/3] animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800" />
          </div>
        </section>

        {/* Recientes */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            🕒 Calificados recientemente
          </h2>
          <p className="mt-2 text-sm text-neutral-500">
            Lo último que has terminado y puntuado.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            <div className="aspect-[2/3] animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800" />
            <div className="aspect-[2/3] animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800" />
          </div>
        </section>

        {/* Favoritos */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            ⭐ Favoritos
          </h2>
          <p className="mt-2 text-sm text-neutral-500">
            Tus obras mejor puntuadas.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            <div className="aspect-[2/3] animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800" />
            <div className="aspect-[2/3] animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800" />
            <div className="aspect-[2/3] animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800" />
          </div>
        </section>
      </div>
    </div>
  );
}