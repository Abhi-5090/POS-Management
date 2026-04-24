import clsx from 'clsx';

const GRADIENTS = {
  blue: 'bg-blue-card shadow-[0_20px_40px_-15px_rgba(59,140,240,0.6)]',
  orange: 'bg-orange-card shadow-[0_20px_40px_-15px_rgba(243,148,33,0.6)]',
};

export default function ModeCard({
  icon: Icon,
  title,
  subtitle,
  variant = 'blue',
  onClick,
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'group relative w-full min-h-[18rem] md:min-h-[22rem] rounded-3xl p-8 overflow-hidden',
        'flex flex-col items-center justify-center text-center text-white',
        'tap-btn transition-transform duration-150 hover:scale-[1.015] active:scale-[0.99] border border-white/15',
        GRADIENTS[variant],
      )}
    >
      <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
      <div className="absolute -left-16 -bottom-16 w-56 h-56 bg-black/20 rounded-full blur-2xl" />

      <div className="relative h-28 w-28 md:h-32 md:w-32 rounded-full bg-white/15 ring-8 ring-white/5 flex items-center justify-center mb-6 backdrop-blur">
        <Icon size={64} strokeWidth={1.5} className="text-white drop-shadow" />
      </div>
      <div className="relative text-3xl md:text-4xl font-extrabold tracking-tight drop-shadow">
        {title}
      </div>
      <div className="relative text-white/85 text-base md:text-lg mt-2 font-medium">
        {subtitle}
      </div>
    </button>
  );
}
