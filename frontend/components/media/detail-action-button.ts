/**
 * Terminal-styled action-button classNames for the show/movie detail headers.
 * Passed as the `className` to the shared <Button> (twMerge lets these override
 * the default outline variant). 40px square (→44px tap target on touch),
 * rounded-sm, #16162a hairline that lights violet on hover, 18px icons.
 */
export const DETAIL_ACTION_BTN =
  "size-10 rounded-sm border border-[#16162a] bg-[#0a0a14] text-white/55 transition-colors hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-violet-300 tap-target [&_svg]:size-[18px]";

/** Primary action (play/resume in Jellyfin) — violet-filled emphasis. */
export const DETAIL_ACTION_BTN_PRIMARY =
  "size-10 rounded-sm border border-violet-500/30 bg-violet-500/10 text-violet-300 transition-colors hover:border-violet-500/50 hover:bg-violet-500/20 hover:text-violet-200 tap-target [&_svg]:size-[18px]";

/** Destructive action (remove from library) — red on hover. */
export const DETAIL_ACTION_BTN_DANGER =
  "size-10 rounded-sm border border-[#16162a] bg-[#0a0a14] text-red-400/65 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300 tap-target [&_svg]:size-[18px]";
