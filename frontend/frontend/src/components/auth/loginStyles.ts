/** Shared layout tokens — matches dashboard shell (`--dash-shell-radius: 28px`). */

export const LOGIN_ROLE_TOGGLE_SHELL =
  "w-80 grid grid-cols-2 gap-3 dash-shell-panel border border-slate-800 bg-slate-950/70 p-2";

export const LOGIN_ROLE_TOGGLE = `mb-5 ${LOGIN_ROLE_TOGGLE_SHELL}`;

export const LOGIN_OUTER_SHELL =
  "relative grid w-full max-w-3xl gap-5 dash-shell-panel border border-white/15 bg-white/8 p-5 shadow-2xl backdrop-blur-2xl";

export const LOGIN_INNER_PANEL =
  "dash-shell-panel border border-white/12 bg-white/8 shadow-inner";

export const LOGIN_SUBTITLE = "mt-1 text-sm font-medium tracking-wide text-slate-300";

export const LOGIN_INPUT =
  "w-full dash-squircle h-12 border border-slate-700/80 bg-slate-950/80 px-5 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

export const LOGIN_INPUT_WITH_LEADING_ICON =
  "w-full dash-squircle h-12 border border-slate-700/80 bg-slate-950/80 py-0 pl-12 pr-5 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

export const LOGIN_PASSWORD_INPUT =
  "w-full dash-squircle h-12 border border-slate-700/80 bg-slate-950/80 py-0 pl-5 pr-12 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

export const LOGIN_FIELD_ICON =
  "pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400";

export const LOGIN_EYE_BUTTON =
  "absolute right-4 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 transition-colors hover:text-white cursor-pointer";

export const LOGIN_SUBMIT_BUTTON =
  "w-full transform-gpu bg-linear-to-r from-blue-600 to-cyan-500 p-4 text-white font-bold transition-[transform,filter,box-shadow] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] hover:brightness-110 hover:shadow-xl hover:shadow-blue-500/30 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100 disabled:active:scale-100 cursor-pointer";
