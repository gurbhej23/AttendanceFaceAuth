/** Shared layout tokens — 100% crystal-clear glassmorphism background with blur. */

export const LOGIN_ROLE_TOGGLE_SHELL =
  "w-80 grid grid-cols-2 gap-3 rounded-2xl border border-white/20 bg-white/5 p-2 backdrop-blur-2xl shadow-xl relative z-20 pointer-events-auto";

export const LOGIN_ROLE_TOGGLE = `mb-6 ${LOGIN_ROLE_TOGGLE_SHELL}`;

export const LOGIN_OUTER_SHELL =
  "relative grid w-full max-w-3xl gap-5 rounded-[36px] border border-white/20 bg-transparent p-6 shadow-2xl backdrop-blur-3xl z-10";

export const LOGIN_INNER_PANEL =
  "rounded-3xl border border-white/15 bg-transparent p-6 backdrop-blur-2xl shadow-inner relative z-10";

export const LOGIN_SUBTITLE = "mt-1 text-sm font-medium tracking-wide text-slate-300";

export const LOGIN_INPUT =
  "w-full rounded-2xl h-12 border border-white/20 bg-white/5 backdrop-blur-xl px-5 text-base text-white outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 relative z-20 pointer-events-auto cursor-text";

export const LOGIN_INPUT_WITH_LEADING_ICON =
  "w-full rounded-2xl h-12 border border-white/20 bg-white/5 backdrop-blur-xl py-0 pl-12 pr-5 text-base text-white outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 relative z-20 pointer-events-auto cursor-text";

export const LOGIN_PASSWORD_INPUT =
  "w-full rounded-2xl h-12 border border-white/20 bg-white/5 backdrop-blur-xl py-0 pl-5 pr-12 text-base text-white outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 relative z-20 pointer-events-auto cursor-text";

export const LOGIN_FIELD_ICON =
  "pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-30";

export const LOGIN_EYE_BUTTON =
  "absolute right-4 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 transition-colors hover:text-white cursor-pointer z-30 pointer-events-auto";

export const LOGIN_SUBMIT_BUTTON =
  "w-full transform-gpu rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 p-4 text-white font-bold transition-[transform,filter,box-shadow] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] hover:brightness-110 hover:shadow-xl hover:shadow-cyan-500/30 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100 disabled:active:scale-100 cursor-pointer relative z-20 pointer-events-auto";
