interface ReportHeaderProps {
  buildingName: string;
  title: string;
  subtitle?: string;
}

export default function ReportHeader({ buildingName, title, subtitle }: ReportHeaderProps) {
  return (
    <div className="text-center mb-12 border-b-4 border-double border-gray-800 pb-6">
      <p className="text-xs uppercase tracking-widest text-gray-500 font-bold mb-2">Administração de Condomínio</p>
      <p className="text-base font-bold text-gray-800">{buildingName}</p>
      <div className="my-4 h-px w-24 bg-gray-400 mx-auto"></div>
      <h1 className="text-3xl font-black mt-1 uppercase tracking-tight">{title}</h1>
      {subtitle && (
        <p className="text-sm font-medium text-gray-600 mt-2 tracking-wide">{subtitle}</p>
      )}
    </div>
  );
}
