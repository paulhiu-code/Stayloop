import { ArrowLeft, Mail, Settings, Shield } from 'lucide-react';

const adminSections = [
  {
    title: 'Email CMS',
    description: 'Manage transactional templates, triggers, sequences, and delivery logs.',
    icon: Mail,
    status: 'Coming next',
  },
  {
    title: 'Platform settings',
    description: 'Reply-to addresses, admin recipients, and sender defaults.',
    icon: Settings,
    status: 'Planned',
  },
  {
    title: 'Access control',
    description: 'Admin-only tools for moderation, referrals, and operational review.',
    icon: Shield,
    status: 'Planned',
  },
];

export default function AdminDashboard({
  onClose,
  adminEmail,
}: {
  onClose: () => void;
  adminEmail?: string | null;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="border-b border-white/10 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-300">StayLoop Admin</p>
            <h1 className="mt-2 text-3xl font-extrabold">Operations dashboard</h1>
            {adminEmail && <p className="mt-1 text-sm text-slate-400">Signed in as {adminEmail}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/5"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to site
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="rounded-3xl border border-orange-400/20 bg-gradient-to-br from-orange-500/10 to-rose-500/10 p-6">
          <h2 className="text-xl font-bold text-white">Admin access is active</h2>
          <p className="mt-2 max-w-3xl text-slate-300">
            Your account can access StayLoop admin tools. The email CMS is the next build step on this dashboard.
          </p>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {adminSections.map((section) => {
            const Icon = section.icon;
            return (
              <div key={section.title} className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                  <Icon className="h-6 w-6 text-orange-300" />
                </div>
                <h3 className="mt-5 text-lg font-bold">{section.title}</h3>
                <p className="mt-2 text-sm text-slate-400">{section.description}</p>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-orange-300">{section.status}</p>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
