import React from "react";
import { ShieldCheck, UserCheck, KeyRound } from "lucide-react";
import AnimatedBackground from "../motion/AnimatedBackground";

export type RegisterWizardStep = "form" | "otp" | "method" | "face" | "pin";

const STEPS: { id: string; label: string; icon: React.ReactNode }[] = [
  { id: "form", label: "Details", icon: <UserCheck size={16} /> },
  { id: "otp", label: "Verification", icon: <ShieldCheck size={16} /> },
  { id: "security", label: "Security", icon: <KeyRound size={16} /> },
];

function stepIndex(step: RegisterWizardStep): number {
  if (step === "form") return 0;
  if (step === "otp") return 1;
  return 2;
}

interface Props {
  step: RegisterWizardStep;
  children: React.ReactNode;
  animClass: string;
}

export default function RegisterWizardLayout({ step, children, animClass }: Props) {
  const currentIndex = stepIndex(step);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-linear-to-br from-[#020617] via-[#0f172a] to-[#111827] p-4 sm:p-6">
      <AnimatedBackground particleColor={0x38bdf8} secondaryColor={0x6366f1} />

      {/* Ambient background glow */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-cyan-500/10 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-indigo-500/10 blur-[100px]" />

      <div className="relative z-10 w-full max-w-2xl">
        {/* Main Card */}
        <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-slate-950/85 p-6 sm:p-8 shadow-[0_0_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
          {/* Header & Stepper */}
          <div className="mb-6 border-b border-white/10 pb-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  Employee Registration
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Attendance System Onboarding
                </p>
              </div>
              <div className="inline-flex items-center gap-1.5 self-start sm:self-auto px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold">
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                Step {currentIndex + 1} of 3
              </div>
            </div>

            {/* Stepper Bar */}
            <div className="grid grid-cols-3 gap-2">
              {STEPS.map((item, idx) => {
                const isDone = idx < currentIndex;
                const isActive = idx === currentIndex;

                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-300 ${
                      isActive
                        ? "bg-gradient-to-r from-blue-600/30 to-cyan-600/30 border border-cyan-500/50 text-white shadow-sm shadow-cyan-500/20"
                        : isDone
                        ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
                        : "bg-white/[0.03] border border-white/5 text-slate-500"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${
                        isActive
                          ? "bg-cyan-500 text-slate-950"
                          : isDone
                          ? "bg-emerald-500 text-slate-950"
                          : "bg-white/10 text-slate-400"
                      }`}
                    >
                      {isDone ? "✓" : idx + 1}
                    </span>
                    <span className="truncate hidden sm:inline">{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step Content */}
          <main className={`wizard-step-panel ${animClass}`}>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
