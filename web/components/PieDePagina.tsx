const REPO = "https://github.com/Vitomans/agenda-reservas";

// Al pie de cada página: que el club es ficticio, quién lo hizo y dónde ver el código y la API
export function PieDePagina() {
  return (
    <footer className="mx-auto w-full max-w-5xl px-4 pt-4 pb-8 text-center text-xs text-slate-500">
      <p>
        Volea es un club ficticio: esta página es un demo de portafolio hecho por{" "}
        <a href="https://github.com/Vitomans" className="font-medium text-slate-700 hover:underline">
          Victor Mendez
        </a>
        .
      </p>
      <p className="mt-1">
        <a href={REPO} className="font-medium text-slate-700 hover:underline">
          Código en GitHub
        </a>
        {" · "}
        <a href="/docs" className="font-medium text-slate-700 hover:underline">
          Documentación de la API
        </a>
      </p>
    </footer>
  );
}
