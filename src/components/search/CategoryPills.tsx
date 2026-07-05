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
        const heroClass = isHero ? 'pill-filter-hero' : '';
        const activeClass = isActive ? 'pill-filter-active' : '';

        return (
          <button
            key={category}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(category)}
            className={`pill-filter ${heroClass} ${activeClass}`}
          >
            {category}
          </button>
        );
      })}
    </div>
  );
}
