import { BadgeCheck } from "lucide-react";
import AnimatedBackground from "../motion/AnimatedBackground";
import ThreeDCardContainer from "../motion/ThreeDCardContainer";

export type RegisterWizardStep = "form" | "otp" | "method" | "face" | "pin";

const STEPS: { id: RegisterWizardStep; label: string }[] = [
  { id: "form", label: "Employee details" },
  { id: "otp", label: "Email verification" },
  { id: "method", label: "Secure setup" },
];

function stepIndex(step: RegisterWizardStep): number {
  if (step === "form") return 0;
  if (step === "otp") return 1;
  return 2;
}

function SidebarWatermark() {
  return (
    <svg
      viewBox="0 0 120 120"
      className="h-28 w-28 text-slate-500"
      aria-hidden
    >
      <circle
        cx="60"
        cy="52"
        r="34"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="4 3"
      />
      <ellipse
        cx="60"
        cy="52"
        rx="14"
        ry="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.75"
      />
      <circle cx="60" cy="52" r="2" fill="currentColor" />
    </svg>
  );
}

interface Props {
  step: RegisterWizardStep;
  children: React.ReactNode;
  animClass: string;
}

export default function RegisterWizardLayout({ step, children, animClass }: Props) {
  const currentIndex = stepIndex(step);

  return (
    <div className="relative flex min-h-screen  justify-center overflow-hidden bg-linear-to-br from-[#020617] via-[#0f172a] to-[#111827] p-4 sm:p-6">
      <AnimatedBackground particleColor={0x3b82f6} secondaryColor={0x06b6d4} />

      <ThreeDCardContainer className="mx-auto my-auto w-full max-w-5xl" maxDegrees={6}>
        <div className="relative grid w-full items-center gap-5 rounded-[36px] border border-white/20 bg-transparent p-4 shadow-2xl backdrop-blur-3xl sm:p-6 lg:grid-rows-[260px_minmax(0,1fr)]">
          <aside className="relative overflow-hidden rounded-3xl border border-white/15 bg-transparent p-4 shadow-inner backdrop-blur-2xl sm:p-5 lg:sticky lg:top-6">
            <div
              className="pointer-events-none absolute -right-4 bottom-2 opacity-[0.07]"
              aria-hidden
            >
              <SidebarWatermark />
            </div>

            <div className="relative z-10 grid grid-cols-2">
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-cyan-300/30 bg-white/10 text-cyan-200 backdrop-blur-md">
                  <BadgeCheck size={26} />
                </div>
                <h1 className="mt-3 text-xl font-bold text-white sm:text-2xl">
                  Attendance
                </h1>
                <p className="mt-0.5 text-xs font-medium text-slate-300 sm:text-sm">
                  Smart Face Recognition System
                </p>
              </div>

              <nav className="space-y-2" aria-label="Registration progress">
                {STEPS.map((item, index) => {
                  const done = index < currentIndex;
                  const active = index === currentIndex;

                  return (
                    <div
                      key={item.id}
                      className={`register-step-pill flex items-center gap-2.5 rounded-2xl border px-2.5 py-2.5 text-sm transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ${active
                        ? "border-blue-500/40 bg-blue-500/15 text-white shadow-lg shadow-blue-500/10"
                        : done
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                          : "border-white/10 bg-white/[0.03] text-slate-400"
                        }`}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${active
                          ? "bg-blue-600 text-white"
                          : done
                            ? "bg-emerald-600 text-white"
                            : "bg-white/10 text-slate-400"
                          }`}
                      >
                        {done ? "✓" : index + 1}
                      </span>
                      <span className="font-medium">{item.label}</span>
                    </div>
                  );
                })}
              </nav>

              <p className="text-center text-[11px] leading-relaxed text-slate-400">
                Credentials are issued after verification and sent to your registered
                email.
              </p>
            </div>
          </aside>

          <main
            className={`wizard-step-panel min-h-[min(72vh,640px)] rounded-3xl border border-white/15 bg-transparent p-5 shadow-inner backdrop-blur-2xl sm:p-7 ${animClass}`}
          >
            {children}
          </main>
        </div>
      </ThreeDCardContainer>
    </div>
  );
}
