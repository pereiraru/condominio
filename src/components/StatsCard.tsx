interface StatsCardProps {
  title: string;
  value: string;
  trend?: number;
  color?: 'blue' | 'green' | 'red' | 'yellow';
}

const colorClasses = {
  blue: 'text-primary-600',
  green: 'text-green-600',
  red: 'text-red-600',
  yellow: 'text-yellow-600',
};

export default function StatsCard({
  title,
  value,
  trend,
  color = 'blue',
}: StatsCardProps) {
  return (
    <div className="card">
      <h3 className="text-sm font-medium text-gray-500 mb-1">{title}</h3>
      <p className={`text-2xl font-bold ${colorClasses[color]}`}>{value}</p>
      {trend !== undefined && (
        <p
          className={`text-sm mt-1 ${
            trend >= 0 ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}% vs mes anterior
        </p>
      )}
    </div>
  );
}
