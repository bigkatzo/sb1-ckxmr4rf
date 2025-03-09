interface SectionHeaderProps {
  title: string;
  description?: string;
}

export function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <div className="mb-4 sm:mb-6">
      <h2 className="text-lg sm:text-2xl font-bold text-white">{title}</h2>
      {description && <p className="mt-1 sm:mt-2 text-xs sm:text-base text-gray-400">{description}</p>}
    </div>
  );
}