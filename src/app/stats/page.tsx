export default function StatsPage() {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 mb-2">
        Estadísticas
      </h1>
      <p className="text-sm text-neutral-500 mb-8">
        Resumen de tu actividad y calificaciones.
      </p>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {["Juegos", "Películas", "Música"].map((cat) => (
          <div
            key={cat}
            className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950"
          >
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
              {cat}
            </h3>
            <div className="mt-4 space-y-3">
              <div className="h-4 w-3/4 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-8 text-center text-sm text-neutral-400">
        Próximamente: gráficos de puntuaciones, géneros favoritos, rachas, etc.
      </p>
    </div>
  );
}
