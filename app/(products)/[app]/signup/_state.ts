// SA-03: the state shared by requestMagicLink (_actions.ts) and SignupFlow.
// It lives outside _actions.ts because a "use server" file may only export
// async functions: exporting this initial object from there made every
// submission fail with a 500 (QA1 B2).
export type SignupState =
  | { status: "idle" }
  | { status: "error"; error: "invalid_email" | "rate_limited" | "bot" | "unexpected" }
  | { status: "sent"; email: string; magicLinkUrl: string | null };

export const initialSignupState: SignupState = { status: "idle" };
