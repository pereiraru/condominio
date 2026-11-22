export const INCIDENT_LOCATIONS = [
  { value: 'elevator', label: 'Elevadores' },
  { value: 'garage', label: 'Garagem / Portão' },
  { value: 'lighting', label: 'Iluminação / Eletricidade' },
  { value: 'door', label: 'Porta / Fechadura / Vídeo-Porteiro' },
  { value: 'water', label: 'Água / Bomba / Canalizações' },
  { value: 'roof', label: 'Cobertura / Fachada' },
  { value: 'cleaning', label: 'Limpeza / Zonas Comuns' },
  { value: 'other', label: 'Outro' },
] as const;

export const INCIDENT_PRIORITIES = [
  { value: 'low', label: 'Baixa' },
  { value: 'normal', label: 'Normal' },
  { value: 'urgent', label: 'Urgente' },
] as const;

export const INCIDENT_STATUSES = [
  { value: 'open', label: 'Registado' },
  { value: 'in_progress', label: 'Em Tratamento' },
  { value: 'scheduled', label: 'Agendado' },
  { value: 'resolved', label: 'Resolvido' },
  { value: 'closed', label: 'Encerrado' },
] as const;

export const LOCATION_LABEL_MAP: Record<string, string> = Object.fromEntries(
  INCIDENT_LOCATIONS.map((l) => [l.value, l.label])
);

export const PRIORITY_STYLE_MAP: Record<
  string,
  { label: string; badgeClass: string }
> = {
  low: {
    label: 'Baixa',
    badgeClass: 'bg-gray-100 text-gray-600 border-gray-200',
  },
  normal: {
    label: 'Normal',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  urgent: {
    label: 'Urgente',
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
  },
};

export const STATUS_STYLE_MAP: Record<
  string,
  { label: string; pillClass: string; iconBgClass: string }
> = {
  open: {
    label: 'Registado',
    pillClass: 'bg-amber-50 text-amber-800 border-amber-200',
    iconBgClass: 'bg-amber-50 text-amber-600',
  },
  in_progress: {
    label: 'Em Tratamento',
    pillClass: 'bg-blue-50 text-blue-700 border-blue-200',
    iconBgClass: 'bg-blue-50 text-blue-600',
  },
  scheduled: {
    label: 'Agendado',
    pillClass: 'bg-purple-50 text-purple-700 border-purple-200',
    iconBgClass: 'bg-purple-50 text-purple-600',
  },
  resolved: {
    label: 'Resolvido',
    pillClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    iconBgClass: 'bg-emerald-50 text-emerald-600',
  },
  closed: {
    label: 'Encerrado',
    pillClass: 'bg-gray-100 text-gray-700 border-gray-200',
    iconBgClass: 'bg-gray-100 text-gray-600',
  },
};

export function isImageMime(mimeType: string, filename: string): boolean {
  if (mimeType.startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp)$/i.test(filename);
}
