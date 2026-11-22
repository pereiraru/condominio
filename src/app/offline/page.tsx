'use client';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[#f5f7fb] flex items-center justify-center p-6">
      <article className="bg-white rounded-3xl border border-slate-200/80 shadow-card max-w-md w-full p-8 text-center">
        <img
          src="/icons/icon-192.png"
          alt="Condomínio"
          width={72}
          height={72}
          className="w-[72px] h-[72px] rounded-2xl mx-auto mb-5 shadow-sm"
        />
        <h1 className="text-xl font-bold text-slate-900">Sem ligação à internet</h1>
        <p className="text-sm text-slate-600 mt-2.5 leading-relaxed">
          O Portal do Condomínio necessita de ligação à internet para mostrar dados financeiros e
          ocorrências atualizados.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-2.5 justify-center">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn-primary text-sm px-6"
          >
            Tentar novamente
          </button>
        </div>
      </article>
    </div>
  );
}
