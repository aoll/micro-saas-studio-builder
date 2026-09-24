"use client";

import { useActionState } from "react";
import { login, type LoginState } from "../_actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction}>
      <div>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" defaultValue="" required />
      </div>
      <div>
        <label htmlFor="password">Mot de passe</label>
        <input id="password" name="password" type="password" autoComplete="current-password" defaultValue="" required />
      </div>
      {state.error ? <p role="alert">{state.error}</p> : null}
      <button type="submit" disabled={pending}>
        Se connecter
      </button>
    </form>
  );
}
