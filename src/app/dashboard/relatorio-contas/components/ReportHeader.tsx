interface ReportHeaderProps {
  buildingName: string;
  year: number;
  title: string;
  subtitle?: string;
}

export default function ReportHeader({ buildingName, year, title, subtitle }: ReportHeaderProps) {
  return (
    <div className="text-center mb-6">
      <p className="text-sm text-gray-500">{buildingName}</p>
      <h1 className="text-2xl font-bold mt-1">{title}</h1>
      {subtitle ? (
        <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
      ) : (
        <p className="text-sm text-gray-600 mt-1">
          Período: 01 de Janeiro a 31 de Dezembro de {year}
        </p>
      )}
    </div>
  );
}
