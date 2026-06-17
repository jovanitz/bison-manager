/**
 * @harness/core — SessionStart context builder (pure). The consuming repo
 * supplies its orientation lines (from harness.config); this shapes the hook
 * output the runtime injects at session start.
 */
export const buildSessionContext = (orientationLines) => ({
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: orientationLines.join(' '),
  },
});
