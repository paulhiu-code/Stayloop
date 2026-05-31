import { stayCategories } from '../../data/showcase';

type CategoryPillsProps = {
  activeCategory?: string;
  onSelect: (category: string) => void;
  variant?: 'hero' | 'search';
  className?: string;
};

export default function CategoryPills({
  activeCategory,
  onSelect,
  variant = 'search',
  className = '',
}: CategoryPillsProps) {
  const isHero = variant === 'hero';

  return (
    <div className={`flex flex-wrap ${isHero ? 'gap-3' : 'gap-2'} ${className}`}>
      {stayCategories.map((category) => {
        const isActive = activeCategory === category;

        const buttonClass = isHero
          ? isActive
            ? 'border-orange-300 bg-orange-400/30 text-white ring-2 ring-orange-300/50'
            : 'border-white/15 bg-white/10 text-white hover:border-orange-300 hover:bg-orange-400/20'
          : isActive
            ? 'border-orange-400 bg-orange-50 text-orange-800 ring-2 ring-orange-200'
            : 'border-orange-200 bg-white text-gray-700 hover:border-orange-400 hover:bg-orange-50';

        return (
          <button
            key={category}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(category)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold backdrop-blur transition ${buttonClass}`}
          >
            {category}
          </button>
        );
      })}
    </div>
  );
}
